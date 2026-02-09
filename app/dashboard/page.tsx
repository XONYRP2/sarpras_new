
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Sarpras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Select a menu from the sidebar to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}