"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTE_TITLES } from "./nav-config";

const titleFor = (segment: string) =>
  ROUTE_TITLES[segment] ?? (/^[a-f\d]{24}$/i.test(segment) ? "Details" : segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()));

export function Breadcrumbs() {
  const segments = usePathname().split("/").filter(Boolean);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const last = i === segments.length - 1;
          return (
            <Fragment key={href}>
              {i > 0 ? <BreadcrumbSeparator className="hidden sm:block" /> : null}
              <BreadcrumbItem className={last ? undefined : "hidden sm:inline-flex"}>
                {last ? (
                  <BreadcrumbPage>{titleFor(segment)}</BreadcrumbPage>
                ) : segment === "settings" ? (
                  <span>{titleFor(segment)}</span>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{titleFor(segment)}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
