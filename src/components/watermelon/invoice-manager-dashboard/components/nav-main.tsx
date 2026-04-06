import {
  type LucideIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    name: string
    url: string
    icon: LucideIcon
    isDisabled?: boolean
  }[]
}) {
  const pathname = "/financial-center/invoice-manager"

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden border-b pb-3 pt-0">
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.name}  >
            <SidebarMenuButton tooltip={item.name} className={`rounded transition-colors duration-200 hover:bg-muted ${pathname === item.url ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/70"}`} isActive={pathname === item.url} render={<a href={item.isDisabled ? "#" : item.url} onClick={(e) => {
                                if (item.isDisabled) {
                                  e.preventDefault();
                                }
                              }} />}><item.icon /><span>{item.name}</span></SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
