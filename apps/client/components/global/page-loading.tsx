import Image from "next/image";
import {
  PageLoader,
  type PageLoaderProps,
} from "@workspace/ui/components/page-loader";
import { logoIcon } from "@/const";

/**
 * App-wide loading screen. Used by every `loading.tsx` route boundary and
 * available as a `<Suspense>` fallback anywhere in the client app.
 */
export default function PageLoading(props: Omit<PageLoaderProps, "logo">) {
  return (
    <PageLoader
      {...props}
      logo={
        <Image
          src={logoIcon}
          alt="Upgence"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          priority
        />
      }
    />
  );
}
