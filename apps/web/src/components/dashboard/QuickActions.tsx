"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Paintbrush, User } from "lucide-react";

interface QuickActionsProps {
  wallet: string | null;
}

const actions = [
  {
    label: "Open Studio",
    description: "Generate new AI artwork variations",
    href: "/studio",
    icon: Paintbrush,
  },
];

export function QuickActions({ wallet }: QuickActionsProps) {
  const items = wallet
    ? [
        ...actions,
        {
          label: "View Profile",
          description: "See your mints and listings",
          href: `/profile/${wallet}`,
          icon: User,
        },
      ]
    : actions;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((action) => (
          <Link key={action.href} href={action.href}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="hover:bg-card-hover transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <action.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="text-sm text-muted">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
