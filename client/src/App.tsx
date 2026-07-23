import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import QuarterMile from "@/pages/quarter-mile";
import Diagnostics from "@/pages/diagnostics";
import AppSettings from "@/pages/app-settings";
import DebugPage from "@/pages/debug";
import UpdatesPage from "@/pages/updates";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/gauges" component={Dashboard} />
        <Route path="/quarter-mile" component={QuarterMile} />
        <Route path="/diagnostics" component={Diagnostics} />
        <Route path="/settings" component={AppSettings} />
        <Route path="/debug" component={DebugPage} />
        <Route path="/updates" component={UpdatesPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
