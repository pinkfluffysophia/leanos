import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-12 px-6">
          <CheckCircle className="h-16 w-16 text-green-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Thank you for your purchase!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your payment was successful. You can view your purchases in your dashboard.
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
            <Link href="/products">
              <Button variant="outline">Browse Products</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
