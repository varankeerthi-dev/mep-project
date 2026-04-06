"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function NavSecondary({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    isDisabled?: boolean
    items?: {
      title: string
      url: string
      isDisabled?: boolean
    }[]
    dialog?: {
      title: string
      description: string
      content: React.ReactNode
    }
  }[]
}) {
  const pathname = "/financial-center/invoice-manager"
  return (
    <SidebarGroup className="py-3! border-b">
      <SidebarMenu>
        {items.map((item) =>
          item.items && item.items.length > 0 ? (
            <Collapsible key={item.title} defaultOpen={item.isActive} className="group/collapsible" render={<SidebarMenuItem />}><CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} className={`rounded transition-colors duration-200 hover:bg-muted ${pathname === item.url ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/70"}`} isActive={pathname === item.url} />}>{item.icon && <item.icon />}<span>{item.title}</span><ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" /></CollapsibleTrigger><CollapsibleContent>
                                  <SidebarMenuSub>
                                    {item.items.map((subItem) => (
                                      <SidebarMenuSubItem key={subItem.title}>
                                        <SidebarMenuSubButton className={`rounded transition-colors duration-200 hover:bg-muted ${pathname === subItem.url ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/70"}`} isActive={pathname === subItem.url} render={<a href={subItem.isDisabled ? "#" : subItem.url} onClick={(e) => {
                                                                        if (subItem.isDisabled) {
                                                                          e.preventDefault();
                                                                        }
                                                                      }} />}><span>{subItem.title}</span></SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))}
                                  </SidebarMenuSub>
                                </CollapsibleContent></Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              {item.dialog ? (
                <Dialog>
                  <DialogTrigger render={<SidebarMenuButton tooltip={item.title} className={`rounded transition-colors duration-200 hover:bg-muted ${pathname === item.url ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/70"}`} />}>{item.icon && <item.icon />}<span>{item.title}</span></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{item.dialog.title}</DialogTitle>
                      <DialogDescription>
                        {item.dialog.description}
                      </DialogDescription>
                    </DialogHeader>
                    {item.dialog.content}
                  </DialogContent>
                </Dialog>
              ) : (
                <SidebarMenuButton tooltip={item.title} className={`rounded transition-colors duration-200 hover:bg-muted ${pathname === item.url ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/70"}`} isActive={pathname === item.url} render={<a href={item.isDisabled ? "#" : item.url} onClick={(e) => {
                                                    if (item.isDisabled) {
                                                      e.preventDefault();
                                                    }
                                                  }} />}>{item.icon && <item.icon />}<span>{item.title}</span></SidebarMenuButton>
              )}
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
