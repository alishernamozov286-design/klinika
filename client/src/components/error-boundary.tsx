/**
 * B8.4: a page that throws while rendering shows this instead of a blank
 * screen — the rest of the app (menu, header) keeps working — and the crash
 * goes to the error log. Keyed by the route, so moving to another page starts
 * fresh.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/error-report";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(Object.assign(new Error(error.message), { name: error.name, stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}` }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center" role="alert" data-testid="error-boundary">
        <div className="icon-tile mb-4 h-14 w-14 bg-rose-500/10 text-rose-600">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold">Sahifada xatolik yuz berdi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Xato avtomatik ravishda tizim jurnaliga yozildi. Kiritilgan ma'lumotlar saqlangan bo'lsa, ular joyida. Qayta urinib ko'ring yoki bosh sahifaga qayting.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => this.setState({ error: null })} data-testid="button-error-retry">
            <RotateCcw className="mr-2 h-4 w-4" />
            Qayta urinish
          </Button>
          <Button variant="outline" asChild>
            <a href="/home">
              <Home className="mr-2 h-4 w-4" />
              Bosh sahifa
            </a>
          </Button>
        </div>
      </div>
    );
  }
}
