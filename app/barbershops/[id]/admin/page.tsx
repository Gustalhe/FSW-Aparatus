import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Header from "@/app/_components/header";
import Footer from "@/app/_components/footer";
import {
  PageContainer,
  PageSection,
  PageSectionTitle,
} from "@/app/_components/ui/page";
import AdminBookingItem from "@/app/_components/admin-booking-item";
import { getBarbershopBookings } from "@/app/_actions/get-barbershop-bookings";
import { Button } from "@/app/_components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/app/_components/ui/badge";

const AdminPage = async (props: PageProps<"/barbershops/[id]/admin">) => {
  const { id } = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: {
      id,
    },
  });

  if (!barbershop) {
    notFound();
  }

  // Verificar se o usuário é o dono da barbearia
  if (barbershop.ownerId !== session.user.id) {
    redirect(`/barbershops/${id}`);
  }

  // Buscar agendamentos
  const bookingsResult = await getBarbershopBookings({
    barbershopId: id,
    status: "all",
  });

  if (bookingsResult?.serverError || bookingsResult?.validationErrors) {
    return (
      <main className="flex h-screen min-h-screen flex-col">
        <Header />
        <div className="flex-1">
          <PageContainer>
            <p className="text-destructive">
              {bookingsResult.serverError ||
                bookingsResult.validationErrors?._errors?.[0] ||
                "Erro ao carregar agendamentos"}
            </p>
          </PageContainer>
        </div>
        <Footer />
      </main>
    );
  }

  const bookings = bookingsResult.data || [];
  const now = new Date();

  const confirmedBookings = bookings.filter(
    (booking) => !booking.cancelled && new Date(booking.date) >= now,
  );

  const cancelledBookings = bookings.filter((booking) => booking.cancelled);

  const finishedBookings = bookings.filter(
    (booking) => !booking.cancelled && new Date(booking.date) < now,
  );

  const totalRevenue = bookings
    .filter((b) => !b.cancelled)
    .reduce((sum, b) => sum + b.service.priceInCents, 0);

  return (
    <main className="flex h-screen min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        <PageContainer>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full"
                asChild
              >
                <Link href={`/barbershops/${id}`}>
                  <ChevronLeft className="size-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-foreground text-xl font-bold">
                  Painel Administrativo
                </h1>
                <p className="text-muted-foreground text-sm">
                  {barbershop.name}
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">
                Total de Agendamentos
              </p>
              <p className="text-foreground text-2xl font-bold">
                {bookings.length}
              </p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Receita Total</p>
              <p className="text-foreground text-2xl font-bold">
                {Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalRevenue / 100)}
              </p>
            </div>
          </div>

          {/* Agendamentos Confirmados */}
          {confirmedBookings.length > 0 && (
            <PageSection>
              <div className="flex items-center justify-between">
                <PageSectionTitle>Confirmados</PageSectionTitle>
                <Badge variant="outline">{confirmedBookings.length}</Badge>
              </div>
              <div className="space-y-3">
                {confirmedBookings.map((booking) => (
                  <AdminBookingItem key={booking.id} booking={booking} />
                ))}
              </div>
            </PageSection>
          )}

          {/* Agendamentos Cancelados */}
          {cancelledBookings.length > 0 && (
            <PageSection>
              <div className="flex items-center justify-between">
                <PageSectionTitle>Cancelados</PageSectionTitle>
                <Badge variant="outline">{cancelledBookings.length}</Badge>
              </div>
              <div className="space-y-3">
                {cancelledBookings.map((booking) => (
                  <AdminBookingItem key={booking.id} booking={booking} />
                ))}
              </div>
            </PageSection>
          )}

          {/* Agendamentos Finalizados */}
          {finishedBookings.length > 0 && (
            <PageSection>
              <div className="flex items-center justify-between">
                <PageSectionTitle>Finalizados</PageSectionTitle>
                <Badge variant="outline">{finishedBookings.length}</Badge>
              </div>
              <div className="space-y-3">
                {finishedBookings.map((booking) => (
                  <AdminBookingItem key={booking.id} booking={booking} />
                ))}
              </div>
            </PageSection>
          )}

          {bookings.length === 0 && (
            <p className="text-muted-foreground text-center text-sm">
              Nenhum agendamento encontrado para esta barbearia.
            </p>
          )}
        </PageContainer>
      </div>
      <Footer />
    </main>
  );
};

export default AdminPage;
