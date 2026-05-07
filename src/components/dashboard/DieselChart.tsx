"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "Mon", total: 120 },
  { name: "Tue", total: 145 },
  { name: "Wed", total: 132 },
  { name: "Thu", total: 156 },
  { name: "Fri", total: 189 },
  { name: "Sat", total: 98 },
  { name: "Sun", total: 45 },
];

export function DieselChart() {
  return (
    <Card data-testid="components-dashboard-DieselChart-card-1" className="col-span-1 md:col-span-4">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">
          Weekly Diesel Consumption (Liters)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0 pl-0 md:pl-2">
        <ResponsiveContainer
          width="100%"
          height={250}
          className="md:!h-[350px]"
        >
          <BarChart data={data}>
            <XAxis
              dataKey="name"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}L`}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Bar
              dataKey="total"
              fill="currentColor"
              radius={[4, 4, 0, 0]}
              className="fill-primary"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
