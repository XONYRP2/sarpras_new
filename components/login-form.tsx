'use client'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { logActivity } from "@/lib/activity"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.rpc("verify_user_login", {
        p_username: username,
        p_password: password,
      })
      if (error) throw error
      if (!data.success) {
        setError(data.error)
        return
      }
      // simpan data user di localStorage
      localStorage.setItem("user", JSON.stringify(data.user))
      // Store profileId explicitly for other pages
      if (data.user?.id) {
        localStorage.setItem("profileId", data.user.id)
      }

      // redirect sesuai role
      await logActivity({
        userId: data.user.id || null,
        action: "login",
        module: "login",
        description: `Login berhasil sebagai ${data.user.role}`,
        dataAfter: { role: data.user.role, username: data.user.username },
      })

      if (data.user.role === "admin") {
        router.push("/dashboard/admin")
      } else if (data.user.role === "petugas") {
        router.push("/dashboard/petugas")
      } else {
        router.push("/dashboard")
      }
    } catch (err: any) {
      setError(err.message || "Login gagal")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = localStorage.getItem("user")
    if (user) {
      const parsedUser = JSON.parse(user)
      if (parsedUser.role === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard")
      }
    }
  }, [])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">SARPRAS</CardTitle>
          <CardDescription>
            Login dengan username dan password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading ? "Loading..." : "Login"}
                </Button>
                {error && (
                  <FieldDescription className="text-center text-destructive">
                    {error}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
