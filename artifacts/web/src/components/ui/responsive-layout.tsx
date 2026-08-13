import * as React from "react"

import { cn } from "@/lib/utils"

// Pattern MVP: les headers empilent titre/actions sur mobile et gardent la ligne desktop.
const PageHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
      className
    )}
    {...props}
  />
)
PageHeader.displayName = "PageHeader"

const PageHeaderContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-w-0 space-y-1", className)} {...props} />
)
PageHeaderContent.displayName = "PageHeaderContent"

const PageHeaderActions = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end",
      className
    )}
    {...props}
  />
)
PageHeaderActions.displayName = "PageHeaderActions"

export { PageHeader, PageHeaderActions, PageHeaderContent }
