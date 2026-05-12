import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { LandingPage } from "@/components/LandingPage";
import { PrivacyPage } from "@/pages/PrivacyPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router base="/landing">
          <Switch>
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/" component={LandingPage} />
          </Switch>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
