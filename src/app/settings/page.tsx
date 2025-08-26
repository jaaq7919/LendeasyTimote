import { FundSourcesManager } from "@/components/settings/fund-sources-manager";


export default function SettingsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
                <p className="text-muted-foreground">
                    Gestiona la configuración general de tu aplicación.
                </p>
            </div>
            
            <FundSourcesManager />
            
        </div>
    );
}