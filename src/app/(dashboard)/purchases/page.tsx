import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchases, products } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Calendar, CreditCard, Package } from "lucide-react";

export default async function PurchasesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const userPurchases = await db
    .select({
      id: purchases.id,
      amount: purchases.amount,
      currency: purchases.currency,
      status: purchases.status,
      createdAt: purchases.createdAt,
      productName: products.name,
      productDescription: products.shortDescription,
      productImage: products.imageUrl,
    })
    .from(purchases)
    .leftJoin(products, eq(purchases.productId, products.id))
    .where(eq(purchases.userId, session.user.id))
    .orderBy(desc(purchases.createdAt));

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchases</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View your purchase history and order details
        </p>
      </div>

      {userPurchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingBag className="h-12 w-12 text-blue-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No purchases yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your purchase history will appear here once you make a purchase.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {userPurchases.map((purchase) => (
            <Card key={purchase.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {purchase.productImage ? (
                      <img
                        src={purchase.productImage}
                        alt={purchase.productName || "Product"}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {purchase.productName || "Unknown Product"}
                      </CardTitle>
                      {purchase.productDescription && (
                        <CardDescription>{purchase.productDescription}</CardDescription>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      purchase.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : purchase.status === "pending"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {purchase.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(purchase.amount, purchase.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(purchase.createdAt)}</span>
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 text-xs">
                    ID: {purchase.id}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
