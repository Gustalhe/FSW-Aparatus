"use server";

import { actionClient } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import z from "zod";
import { endOfDay, format, startOfDay } from "date-fns";

const inputSchema = z.object({
  barbershopId: z.string(),
  date: z.date(),
});

const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

export const getDateAvailableTimeSlots = actionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, date } }) => {
    try {
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);

      const bookings = await prisma.booking.findMany({
        where: {
          barbershopId,
          cancelled: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const occupiedSlots = bookings.map((booking) =>
        format(booking.date, "HH:mm"),
      );
      const availableTimeSlots = TIME_SLOTS.filter(
        (slot) => !occupiedSlots.includes(slot),
      );

      return availableTimeSlots;
    } catch (error) {
      console.error("Error in getDateAvailableTimeSlots:", error);
      throw error;
    }
  });

//   => ["10:00", "11:00"]

// Toda barbearia vai ter horários das 09h às 18h.
// Todo serviço vai ocupar 30 minutos.
