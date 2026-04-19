import { EditProductPage } from "@/modules/inventory/ui/edit-product-page";

export const metadata = { title: "Edit product" };

export default async function EditProductRoutePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <EditProductPage productId={productId} />;
}
