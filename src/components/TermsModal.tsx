import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "en" | "pt" | "es";
}

const TERMS = {
  en: `By using Shinely, you agree that:

(1) You are 18+ years old.

(2) Payments must be made exclusively through the platform.

(3) Sharing contact information in chat is prohibited.

(4) Cleaners/Helpers must complete accepted jobs or face account penalties.

(5) Cancellations within 24h result in penalties.

(6) Owners may not hire Cleaners outside the platform for 12 months.

(7) Shinely retains a platform fee of 10% (5% for Premium).

(8) Violations may result in account suspension.`,
  pt: `Ao usar o Shinely, você concorda que:

(1) Você tem 18+ anos.

(2) Pagamentos devem ser feitos exclusivamente pela plataforma.

(3) Compartilhar informações de contato no chat é proibido.

(4) Cleaners/Helpers devem completar jobs aceitos ou enfrentar penalidades.

(5) Cancelamentos em menos de 24h resultam em penalidades.

(6) Owners não podem contratar Cleaners fora da plataforma por 12 meses.

(7) O Shinely retém uma taxa de 10% (5% para Premium).

(8) Violações podem resultar em suspensão da conta.`,
  es: `Al usar Shinely, aceptas que:

(1) Tienes 18+ años.

(2) Los pagos deben realizarse exclusivamente a través de la plataforma.

(3) Compartir información de contacto en el chat está prohibido.

(4) Los Cleaners/Helpers deben completar los trabajos aceptados o enfrentar penalidades.

(5) Las cancelaciones en menos de 24h resultan en penalidades.

(6) Los Owners no pueden contratar Cleaners fuera de la plataforma por 12 meses.

(7) Shinely retiene una tarifa del 10% (5% para Premium).

(8) Las violaciones pueden resultar en la suspensión de la cuenta.`,
};

const TITLES = {
  en: "Terms of Service & Privacy Policy",
  pt: "Termos de Uso e Política de Privacidade",
  es: "Términos de Uso y Política de Privacidad",
};

export default function TermsModal({ open, onOpenChange, defaultTab = "en" }: TermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-primary">{TITLES[defaultTab]}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-primary/10">
            <TabsTrigger value="en" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">EN</TabsTrigger>
            <TabsTrigger value="pt" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">PT</TabsTrigger>
            <TabsTrigger value="es" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">ES</TabsTrigger>
          </TabsList>
          {(["en", "pt", "es"] as const).map((lang) => (
            <TabsContent key={lang} value={lang} className="mt-4">
              <ScrollArea className="h-[55vh] pr-3">
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{TERMS[lang]}</p>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
