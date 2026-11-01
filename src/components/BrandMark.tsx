import { cx } from "./ui";

/**
 * The salon's round logo mark. It has no city printed on it, so it is right for every branch.
 * (The full badge with the city name is for materials made for one branch.)
 */
export default function BrandMark({ className }: { className?: string }) {
  return <img src="/bbh-icon.png" alt="" width={512} height={512} decoding="async" className={cx("shrink-0 rounded-full", className)} />;
}
