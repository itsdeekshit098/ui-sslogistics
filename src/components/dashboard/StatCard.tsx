import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComponentIcon } from "@/components/ui/icon";

interface StatCardProps {
    title: string;
    value: string;
    description: string;
    icon: ComponentIcon;
    trend?: {
        value: number;
        label: string;
    };
}

export function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
    return (
        <Card data-testid="components-dashboard-StatCard-card-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon size={16} style={{ color: "var(--muted-foreground)" }} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">
                    {description}
                </p>
                {trend && (
                    <div className={`text-xs mt-1 ${trend.value > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
