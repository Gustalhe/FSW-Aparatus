"use client";

import Image from "next/image";
import { BarbershopService, Barbershop } from "@/generated/prisma/client";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Calendar } from "./ui/calendar";
import { Separator } from "./ui/separator";
import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { useAction } from "next-safe-action/hooks";
import { createBooking } from "../_actions/create-booking";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getDateAvailableTimeSlots } from "../_actions/get-date-available-time-slots";
import { createBookingCheckoutSession } from "../_actions/create-booking-checkout-session";
import { loadStripe } from "@stripe/stripe-js";

interface ServiceItemProps {
  service: BarbershopService & {
    barbershop: Barbershop;
  };
}

export function ServiceItem({ service }: ServiceItemProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  const { isPending } = useAction(createBooking);
  const { executeAsync: executeCreateBookingCheckoutSession } = useAction(
    createBookingCheckoutSession,
  );
  const [sheetIsOpen, setSheetIsOpen] = useState(false);
  const {
    data: availableTimeSlotsResult,
    isLoading: isLoadingTimeSlots,
    error: timeSlotsError,
  } = useQuery({
    queryKey: ["date-available-time-slots", service.barbershopId, selectedDate],
    queryFn: async () => {
      // Normalizar a data para garantir que a hora seja 00:00:00
      const normalizedDate = selectedDate
        ? new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
          )
        : undefined;

      if (!normalizedDate) {
        return [];
      }

      const result = await getDateAvailableTimeSlots({
        barbershopId: service.barbershopId,
        date: normalizedDate,
      });

      if (result?.serverError || result?.validationErrors) {
        const errorMessage =
          result.validationErrors?._errors?.[0] ||
          result.serverError ||
          "Erro ao buscar horários disponíveis";
        throw new Error(errorMessage);
      }

      // Garantir que sempre retornamos um array
      const data = result?.data;

      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    },
    enabled: Boolean(selectedDate),
    initialData: [],
  });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const priceInReais = (service.priceInCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const priceInReaisInteger = Math.floor(service.priceInCents / 100);

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : "";

  const isConfirmDisabled = !selectedDate || !selectedTime;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleConfirm = async () => {
    if (!selectedTime || !selectedDate) {
      return;
    }

    // Verificar variáveis de ambiente no cliente
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!stripePublishableKey) {
      toast.error(
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY não está configurada. Configure as variáveis de ambiente do Stripe no arquivo .env.local",
      );
      console.error(
        "Variável de ambiente faltando: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      );
      return;
    }

    const timeSplitted = selectedTime.split(":"); // [10, 00]
    const hours = timeSplitted[0];
    const minutes = timeSplitted[1];
    const date = new Date(selectedDate);
    date.setHours(Number(hours), Number(minutes));

    const checkoutSessionResult = await executeCreateBookingCheckoutSession({
      serviceId: service.id,
      date,
    });

    if (
      checkoutSessionResult.serverError ||
      checkoutSessionResult.validationErrors
    ) {
      const errorMessage =
        checkoutSessionResult.serverError ||
        checkoutSessionResult.validationErrors?._errors?.[0] ||
        "Erro ao criar checkout session";
      toast.error(errorMessage);
      console.error("Checkout session error:", {
        serverError: checkoutSessionResult.serverError,
        validationErrors: checkoutSessionResult.validationErrors,
      });
      return;
    }

    if (!checkoutSessionResult.data?.id) {
      toast.error("Erro: ID da sessão de checkout não foi retornado");
      return;
    }

    const stripe = await loadStripe(stripePublishableKey);
    if (!stripe) {
      toast.error("Erro ao carregar biblioteca do Stripe");
      return;
    }
    await stripe.redirectToCheckout({
      sessionId: checkoutSessionResult.data.id,
    });
    // // 10:00
    // if (!selectedTime || !selectedDate) {
    //   return;
    // }

    // const result = await executeAsync({
    //   serviceId: service.id,
    //   date,
    // });
    // if (result.serverError || result.validationErrors) {
    //   toast.error(result.validationErrors?._errors?.[0]);
    //   return;
    // }
    // toast.success("Agendamento criado com sucesso!");
    // setSelectedDate(undefined);
    // setSelectedTime(undefined);
    // setSheetIsOpen(false);
  };

  return (
    <Sheet open={sheetIsOpen} onOpenChange={setSheetIsOpen}>
      <div className="border-border bg-card flex items-center justify-center gap-3 rounded-2xl border border-solid p-3">
        <div className="relative size-[110px] shrink-0 overflow-hidden rounded-[10px]">
          <Image
            src={service.imageUrl}
            alt={service.name}
            fill
            className="object-cover"
          />
        </div>

        <div className="flex grow basis-0 flex-row items-center self-stretch">
          <div className="relative flex h-full min-h-0 min-w-0 grow basis-0 flex-col items-start justify-between">
            <div className="flex h-[67.5px] w-full flex-col items-start gap-1 text-sm leading-[1.4]">
              <p className="text-card-foreground w-full font-bold">
                {service.name}
              </p>
              <p className="text-muted-foreground w-full font-normal">
                {service.description}
              </p>
            </div>

            <div className="flex w-full items-center justify-between">
              <p className="text-card-foreground text-sm leading-[1.4] font-bold whitespace-pre">
                {priceInReais}
              </p>
              <SheetTrigger asChild>
                <Button className="rounded-full px-4 py-2">Reservar</Button>
              </SheetTrigger>
            </div>
          </div>
        </div>
      </div>

      <SheetContent className="w-[370px] overflow-y-auto p-0">
        <div className="flex h-full flex-col gap-6">
          <SheetHeader className="px-5 pt-6">
            <SheetTitle className="text-lg font-bold">Fazer Reserva</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-5">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={{ before: today }}
              className="w-full p-0"
              locale={ptBR}
            />
          </div>

          {selectedDate && (
            <>
              <Separator />

              <div className="flex gap-3 overflow-x-auto px-5 [&::-webkit-scrollbar]:hidden">
                {isLoadingTimeSlots ? (
                  <p className="text-muted-foreground text-sm">
                    Carregando horários...
                  </p>
                ) : timeSlotsError ? (
                  <p className="text-destructive text-sm">
                    Erro ao carregar horários
                  </p>
                ) : (
                  (availableTimeSlotsResult || []).map((time: string) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      className="shrink-0 rounded-full px-4 py-2"
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  ))
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-3 px-5">
                <div className="border-border bg-card flex w-full flex-col gap-3 rounded-[10px] border border-solid p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-card-foreground text-base font-bold">
                      {service.name}
                    </p>
                    <p className="text-card-foreground text-sm font-bold">
                      R${priceInReaisInteger},00
                    </p>
                  </div>

                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <p>Data</p>
                    <p>{formattedDate}</p>
                  </div>

                  {selectedTime && (
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <p>Horário</p>
                      <p>{selectedTime}</p>
                    </div>
                  )}

                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <p>Barbearia</p>
                    <p>{service.barbershop.name}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-6">
                <Button
                  className="w-full rounded-full"
                  disabled={isConfirmDisabled || isPending}
                  onClick={handleConfirm}
                >
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
