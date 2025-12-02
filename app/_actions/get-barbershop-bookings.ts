"use server";

import { actionClient } from "@/lib/action-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { headers } from "next/headers";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.string().uuid(),
  status: z.enum(["all", "confirmed", "cancelled", "finished"]).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export const getBarbershopBookings = actionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, status, dateFrom, dateTo } }) => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      returnValidationErrors(inputSchema, {
        _errors: ["Não autorizado"],
      });
    }

    // Verificar se o usuário é o dono da barbearia
    const barbershop = await prisma.barbershop.findUnique({
      where: {
        id: barbershopId,
      },
    });

    if (!barbershop) {
      returnValidationErrors(inputSchema, {
        _errors: ["Barbearia não encontrada"],
      });
    }

    if (barbershop.ownerId !== session.user.id) {
      returnValidationErrors(inputSchema, {
        _errors: ["Você não tem permissão para acessar esta barbearia"],
      });
    }

    const now = new Date();

    // Construir filtros
    const where: any = {
      barbershopId,
    };

    // Filtro por status
    if (status === "confirmed") {
      where.cancelled = false;
      where.date = {
        gte: now,
      };
    } else if (status === "cancelled") {
      where.cancelled = true;
    } else if (status === "finished") {
      where.cancelled = false;
      where.date = {
        lt: now,
      };
    }

    // Filtro por data (se não houver filtro de status que já define date)
    if (dateFrom || dateTo) {
      if (status === "confirmed") {
        // Se já tem filtro de data por status, mesclar
        where.date = {
          gte: dateFrom || now,
          ...(dateTo && { lte: dateTo }),
        };
      } else {
        where.date = {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        };
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: true,
        barbershop: {
          select: {
            id: true,
            name: true,
            address: true,
            imageUrl: true,
            phones: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return bookings;
  });

