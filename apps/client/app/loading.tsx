import React from "react";
import Image from "next/image";
import { logoIcon } from "@/const";
import { PageLoader } from "@workspace/ui/components/page-loader";

export default function Loading() {
  return (
    <PageLoader
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
