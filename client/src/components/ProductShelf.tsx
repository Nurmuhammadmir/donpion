import { Link } from "@/i18n/Link";
import ProductCard from "@/components/ProductCard";
import type { ProductCardData } from "@/types";

interface ProductShelfProps {
  products: ProductCardData[];
  seeAllHref: string;
  seeAllLabel: string;
  seeAllLine1: string;
  seeAllLine2: string;
  emptyText: string;
}

// Shared "shelf" shape used by every homepage product strip (Luxury
// Collection, the chocolate/add-on shelf, the occasion picker's results) —
// desktop shows a fixed one-row grid of 4, phone/tablet gets a horizontal
// scroll strip with up to 8 (scrolling makes the extra 4 free, a plain
// grid wouldn't). No hooks/directives, so it renders fine from either a
// server page or a "use client" component.
export default function ProductShelf({ products, seeAllHref, seeAllLabel, seeAllLine1, seeAllLine2, emptyText }: ProductShelfProps) {
  if (products.length === 0) {
    return <p className="text-center text-sm text-graphite">{emptyText}</p>;
  }

  return (
    <>
      <div className="-mx-6 flex scroll-touch no-scrollbar gap-4 overflow-x-auto scroll-smooth px-6 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0 lg:pb-0">
        {products.slice(0, 8).map((product, i) => (
          <div
            key={product._id}
            className={`w-[45%] flex-shrink-0 sm:w-[42%] lg:w-auto lg:flex-shrink ${i >= 4 ? "lg:hidden" : ""}`}
          >
            <ProductCard product={product} />
          </div>
        ))}
        {/* Mobile/tablet: "see all" rides at the end of the same strip
            instead of a separate block below it. */}
        <Link
          href={seeAllHref}
          className="flex aspect-[3/4] w-[45%] flex-shrink-0 flex-col items-center justify-center text-center sm:w-[42%] lg:hidden"
        >
          <span className="text-xs font-medium uppercase tracking-wide2 text-hermes-500">
            {seeAllLine1}
            <br />
            {seeAllLine2}
          </span>
        </Link>
      </div>

      <div className="mt-14 hidden text-center lg:block">
        <Link href={seeAllHref} className="text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4">
          {seeAllLabel}
        </Link>
      </div>
    </>
  );
}
