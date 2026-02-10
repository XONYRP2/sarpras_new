
"use client"

import * as React from "react"
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  FileText,
  Layers,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Tags,
  Users,
} from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LogOut, User, ChevronsUpDown } from "lucide-react"

const adminNav = [
  {
    title: "Dashboard",
    url: "/dashboard/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Manajemen User",
    url: "/dashboard/admin/users",
    icon: Users,
  },
  {
    title: "Kategori Sarpras",
    url: "/dashboard/admin/kategori",
    icon: Tags,
  },
  {
    title: "Lokasi Sarpras",
    url: "/dashboard/admin/lokasi",
    icon: MapPin,
  },
  {
    title: "Data Sarpras",
    url: "/dashboard/admin/sarpras",
    icon: Package,
  },
  {
    title: "Peminjaman",
    url: "/dashboard/admin/peminjaman",
    icon: ArrowUpRight,
  },
  {
    title: "Pengembalian",
    url: "/dashboard/admin/pengembalian",
    icon: ArrowDownLeft,
  },
  {
    title: "Pengaduan",
    url: "/dashboard/admin/pengaduan",
    icon: AlertCircle,
  },
  {
    title: "Laporan Asset",
    url: "/dashboard/admin/laporan",
    icon: FileText,
  },
  {
    title: "Activity Log",
    url: "/dashboard/admin/activity",
    icon: Activity,
  },
]

const petugasNav = [
  {
    title: "Dashboard",
    url: "/dashboard/petugas",
    icon: LayoutDashboard,
  },
  {
    title: "Data Sarpras",
    url: "/dashboard/petugas/sarpras",
    icon: Package,
  },
  {
    title: "Peminjaman",
    url: "/dashboard/petugas/peminjaman",
    icon: ArrowUpRight,
  },
  {
    title: "Pengembalian",
    url: "/dashboard/petugas/pengembalian",
    icon: ArrowDownLeft,
  },
  {
    title: "Pengaduan",
    url: "/dashboard/petugas/pengaduan",
    icon: AlertCircle,
  },
  // Add more as needed
]

const penggunaNav = [
  {
    title: "Dashboard",
    url: "/dashboard/pengguna",
    icon: LayoutDashboard,
  },
  {
    title: "Sarpras Tersedia",
    url: "/dashboard/pengguna/sarpras",
    icon: Package,
  },
  {
    title: "Peminjaman Saya",
    url: "/dashboard/pengguna/peminjaman",
    icon: ArrowUpRight,
  },
  {
    title: "Pengaduan Saya",
    url: "/dashboard/pengguna/pengaduan",
    icon: AlertCircle,
  },
  // Add more as needed
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [logoutOpen, setLogoutOpen] = React.useState(false)

  const handleLogout = () => {
    localStorage.removeItem('profileId')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  let navItems = penggunaNav
  let label = "Pengguna"

  if (pathname.startsWith("/dashboard/admin")) {
    navItems = adminNav
    label = "Admin"
  } else if (pathname.startsWith("/dashboard/petugas")) {
    navItems = petugasNav
    label = "Petugas"
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2 font-bold text-xl text-primary">
          <Package className="h-6 w-6" />
          <span className="group-data-[collapsible=icon]:hidden">Sarpras</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    suppressHydrationWarning
                  >
                    <User className="h-8 w-8 rounded-lg bg-gray-100 p-1" />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{label}</span>
                      <span className="truncate text-xs">Account</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuItem asChild>
                    <a href={`/dashboard/${label.toLowerCase()}/profile`} className="cursor-pointer flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => setLogoutOpen(true)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
      <SidebarRail />

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apakah anda yakin ingin logout?</DialogTitle>
            <DialogDescription>
              Anda akan diarahkan ke halaman sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleLogout}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar >
  )
}
