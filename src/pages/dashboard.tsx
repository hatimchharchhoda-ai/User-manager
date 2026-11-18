import { useEffect, useState } from "react"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
    Bar,
    BarChart,
    PieChart,
    Pie,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    RadialBarChart,
    RadialBar,
} from "recharts"
import {
    AlertCircle,
    Bell,
    CheckCircle2,
    ChevronDown,
    CircleDot,
    Clock,
    Download,
    Filter,
    Info,
    LayoutDashboard,
    LogOut,
    MoreHorizontal,
    RefreshCw,
    Search,
    Settings,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
    User,
    UserMinus,
    Users,
    Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "../components/ui/skeleton"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "../components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Button } from "../components/ui/button"
import { Checkbox } from "../components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu"
import { Input } from "../components/ui/input"
import { Progress } from "../components/ui/progress"
import { ScrollArea } from "../components/ui/scroll-area"
import { Separator } from "../components/ui/separator"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet"
import { Switch } from "../components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"

// ─── Data imports ──────────────────────────────────────────────────────────────
import kpiData from "../data/dashboardData/kpi.json"
import revenueData from "../data/dashboardData/revenue.json"
import ordersData from "../data/dashboardData/orders.json"
import usersData from "../data/dashboardData/users.json"
import tasksData from "../data/dashboardData/tasks.json"
import systemData from "../data/dashboardData/system.json"
import { Badge } from "../components/ui/badge"
import { Label } from "../components/ui/label"

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = "Completed" | "Processing" | "Pending" | "Failed"
type ProjectStatus = "On Track" | "At Risk" | "Delayed"
type ServiceStatus = "Healthy" | "Degraded" | "Warning"
type NotificationType = "error" | "warning" | "info" | "success"
type TeamStatus = "Active" | "Away" | "Inactive"

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    n >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)}M`
        : n >= 1_000
            ? `${(n / 1_000).toFixed(1)}K`
            : String(n)

const orderStatusVariant = (s: OrderStatus): "default" | "secondary" | "outline" | "destructive" =>
    ({ Completed: "default", Processing: "secondary", Pending: "outline", Failed: "destructive" } as const)[s]

const projectStatusVariant = (s: ProjectStatus): "default" | "secondary" | "destructive" =>
    ({ "On Track": "default", "At Risk": "secondary", Delayed: "destructive" } as const)[s]

const serviceStatusVariant = (s: ServiceStatus): "default" | "secondary" | "destructive" =>
    ({ Healthy: "default", Degraded: "destructive", Warning: "secondary" } as const)[s]

const teamStatusVariant = (s: TeamStatus): "default" | "secondary" | "outline" =>
    ({ Active: "default", Away: "secondary", Inactive: "outline" } as const)[s]

const priorityVariant = (p: string): "default" | "secondary" | "outline" | "destructive" => {
    const map: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
        Critical: "destructive", High: "default", Medium: "secondary", Low: "outline",
    }
    return map[p] ?? "outline"
}

const notifIcon = (type: NotificationType) => {
    const map = {
        error: <AlertCircle className="h-4 w-4 text-destructive" />,
        warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
        info: <Info className="h-4 w-4 text-blue-500" />,
        success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    }
    return map[type]
}

const kpiIcon = (icon: string) => {
    const map: Record<string, React.ReactNode> = {
        TrendingUp: <TrendingUp className="h-5 w-5" />,
        Users: <Users className="h-5 w-5" />,
        ShoppingCart: <ShoppingCart className="h-5 w-5" />,
        UserMinus: <UserMinus className="h-5 w-5" />,
    }
    return map[icon] ?? <Zap className="h-5 w-5" />
}

// ─── Chart configs ─────────────────────────────────────────────────────────────

const revenueChartConfig = {
    revenue: { label: "Revenue", color: "var(--primary)" },
    expenses: { label: "Expenses", color: "var(--chart-3)" },
    profit: { label: "Profit", color: "var(--chart-2)" },
}

const orderVolumeConfig = { orders: { label: "Orders", color: "var(--primary)" } }

const pieConfig = { value: { label: "Share", color: "var(--primary)" } }

const regionConfig = { users: { label: "Users", color: "var(--primary)" } }

const retentionConfig = { retained: { label: "Retention %", color: "var(--primary)" } }

const cpuConfig = {
    cpu: { label: "CPU %", color: "var(--primary)" },
    memory: { label: "Memory %", color: "var(--chart-3)" },
}

const radialConfig = { count: { label: "Tasks", color: "var(--primary)" } }

// ─── Sub-components ────────────────────────────────────────────────────────────

// Loading skeleton shared across sections
function SectionSkeleton() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
        </div>
    )
}

// ─── PAGE 1: Overview ──────────────────────────────────────────────────────────

function OverviewPage() {
    const [period, setPeriod] = useState("12m")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 600)
        return () => clearTimeout(t)
    }, [])

    const monthlySlice =
        period === "6m"
            ? revenueData.monthly.slice(-6)
            : period === "3m"
                ? revenueData.monthly.slice(-3)
                : revenueData.monthly

    if (loading) return <div className="p-6 space-y-6"><SectionSkeleton /><SectionSkeleton /></div>

    return (
        <div className="p-6 space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiData.kpis.map((kpi) => (
                    <Card key={kpi.id}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardDescription>{kpi.label}</CardDescription>
                                <span className="text-muted-foreground">{kpiIcon(kpi.icon)}</span>
                            </div>
                            <CardTitle className="text-2xl">
                                {kpi.prefix}{fmt(kpi.value)}{kpi.suffix}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`flex items-center gap-1 text-xs ${kpi.trend === "up" ? "text-green-600" :
                                kpi.trend === "down-good" ? "text-green-600" : "text-destructive"
                                }`}>
                                {kpi.trend === "up" || kpi.trend === "down-good"
                                    ? <TrendingUp className="h-3 w-3" />
                                    : <TrendingDown className="h-3 w-3" />}
                                <span>{kpi.change > 0 ? "+" : ""}{kpi.change}%</span>
                                {/* ms-1 replaces ms-1 — logical margin for inline start */}
                                <span className="text-muted-foreground ms-1">{kpi.changeLabel}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Revenue area chart */}
            <Card>
                <CardHeader>
                    <div>
                        <CardTitle>Revenue vs Expenses</CardTitle>
                        <CardDescription>Monthly financial performance</CardDescription>
                    </div>
                    <CardAction>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-28 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3m">Last 3M</SelectItem>
                                <SelectItem value="6m">Last 6M</SelectItem>
                                <SelectItem value="12m">Last 12M</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={revenueChartConfig} className="h-64 w-full">
                        <AreaChart data={monthlySlice}>
                            <defs>
                                <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="exp-fill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                            <YAxis hide />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="url(#rev-fill)" strokeWidth={2} />
                            <Area type="monotone" dataKey="expenses" stroke="var(--color-expenses)" fill="url(#exp-fill)" strokeWidth={2} />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Bottom row: channel pie + order volume bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue by Channel</CardTitle>
                        <CardDescription>Acquisition source breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={pieConfig} className="h-52">
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Pie
                                    data={revenueData.byChannel}
                                    dataKey="value"
                                    nameKey="channel"
                                    outerRadius={80}
                                    fill="var(--color-value)"
                                />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Weekly Order Volume</CardTitle>
                        <CardDescription>Orders placed per day this week</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={orderVolumeConfig} className="h-52">
                            <BarChart data={ordersData.weeklyVolume}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                                <YAxis hide />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="orders" fill="var(--color-orders)" radius={6} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ─── PAGE 2: Orders ────────────────────────────────────────────────────────────

function OrdersPage() {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("All")
    const [confirmId, setConfirmId] = useState<string | null>(null)
    const statuses = ["All", "Completed", "Processing", "Pending", "Failed"]

    const filtered = ordersData.recent.filter((o) => {
        const matchSearch =
            o.customer.toLowerCase().includes(search.toLowerCase()) ||
            o.id.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === "All" || o.status === statusFilter
        return matchSearch && matchStatus
    })

    const handleCancel = (id: string) => {
        toast.success(`Order ${id} has been cancelled.`)
        setConfirmId(null)
    }

    return (
        <div className="p-6 space-y-6">
            {/* Status cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {ordersData.statusBreakdown.map((s) => (
                    <Card key={s.status}>
                        <CardContent className="pt-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">{s.status}</span>
                                <Badge variant={orderStatusVariant(s.status as OrderStatus)}>{s.status}</Badge>
                            </div>
                            <p className="text-2xl font-bold">{s.count}</p>
                            <Progress value={s.percentage} className="h-1.5 mt-2" />
                            <p className="text-xs text-muted-foreground mt-1">{s.percentage}% of total</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table + filters */}
            <Card>
                <CardHeader>
                    <div>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Latest transactions across all products</CardDescription>
                    </div>
                    <CardAction className="flex gap-2">
                        <div className="relative">
                            {/* start-* replaces start-* for icon positioning inside input */}
                            <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            {/* ps-* replaces ps-* for padding on the icon side */}
                            <Input
                                className="ps-8 h-8 w-44 text-xs"
                                placeholder="Search orders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                                {/* me-* replaces me-* for icon margin on end side */}
                                <Filter className="h-3 w-3 me-1" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {statuses.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardAction>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead className="w-10"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                                        No orders match your filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs">{order.id}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-7 w-7">
                                                    <AvatarFallback className="text-xs">{order.avatar}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{order.customer}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">{order.product}</TableCell>
                                        <TableCell className="font-medium">${order.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={orderStatusVariant(order.status as OrderStatus)}>
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{order.date}</TableCell>
                                        <TableCell>
                                            {order.status !== "Completed" && order.status !== "Failed" && (
                                                <AlertDialog open={confirmId === order.id} onOpenChange={(o) => !o && setConfirmId(null)}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmId(order.id)}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Cancel order {order.id}?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will cancel the order for {order.customer}. This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel size={undefined} variant={undefined}>Keep order</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleCancel(order.id)} size={undefined} variant={undefined}>
                                                                Cancel order
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Radar — order status distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Order Status Distribution</CardTitle>
                    <CardDescription>Visual breakdown of order states this month</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{ count: { label: "Count", color: "var(--primary)" } }} className="h-56">
                        <RadarChart data={ordersData.statusBreakdown.map(s => ({ ...s, label: s.status }))}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="label" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Radar dataKey="count" fill="var(--primary)" stroke="var(--primary)" fillOpacity={0.35} />
                        </RadarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    )
}

// ─── PAGE 3: Team ──────────────────────────────────────────────────────────────

function TeamPage() {
    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteName, setInviteName] = useState("")
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState("Viewer")
    const [alertDismissed, setAlertDismissed] = useState(false)

    const handleInvite = () => {
        toast.success(`Invite sent to ${inviteEmail}`)
        setInviteOpen(false)
        setInviteName("")
        setInviteEmail("")
    }

    return (
        <div className="p-6 space-y-6">
            {!alertDismissed && (
                <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>Seat limit approaching</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <span>You're using 5 of 8 seats on your current plan.</span>
                        {/* ms-* replaces ms-* for logical inline-start margin */}
                        <Button size="xs" variant="outline" className="ms-4" onClick={() => setAlertDismissed(true)}>
                            Dismiss
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Team table + invite */}
            <Card>
                <CardHeader>
                    <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>Manage roles and permissions</CardDescription>
                    </div>
                    <CardAction>
                        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">Invite member</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite a team member</DialogTitle>
                                    <DialogDescription>
                                        They'll receive an email to join your workspace.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3 py-2">
                                    <div className="space-y-1.5">
                                        <Label>Full name</Label>
                                        <Input id="inv-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Doe" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Work email</Label>
                                        <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@company.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Role</Label>
                                        <Select value={inviteRole} onValueChange={setInviteRole}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Admin">Admin</SelectItem>
                                                <SelectItem value="Editor">Editor</SelectItem>
                                                <SelectItem value="Viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button onClick={handleInvite} disabled={!inviteEmail || !inviteName}>
                                        Send invite
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardAction>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last seen</TableHead>
                                <TableHead>Tasks done</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usersData.team.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-7 w-7">
                                                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                                    {member.avatar}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">{member.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{member.role}</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{member.department}</TableCell>
                                    <TableCell>
                                        <Badge variant={teamStatusVariant(member.status as TeamStatus)}>
                                            {member.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{member.lastSeen}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={(member.tasksCompleted / 60) * 100} className="h-1.5 w-16" />
                                            <span className="text-xs text-muted-foreground">{member.tasksCompleted}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Region radar + retention line */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Users by Region</CardTitle>
                        <CardDescription>Active user distribution worldwide</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={regionConfig} className="h-56">
                            <RadarChart data={usersData.growthByRegion}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="region" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Radar dataKey="users" fill="var(--color-users)" stroke="var(--color-users)" fillOpacity={0.4} />
                            </RadarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>8-Week Retention</CardTitle>
                        <CardDescription>% of users still active after signup</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={retentionConfig} className="h-56">
                            <LineChart data={usersData.retentionByWeek}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                                <YAxis domain={[40, 100]} hide />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Line dataKey="retained" stroke="var(--color-retained)" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ─── PAGE 4: Projects ──────────────────────────────────────────────────────────

function ProjectsPage() {
    const [tasks, setTasks] = useState(tasksData.upcoming)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [newTask, setNewTask] = useState({ title: "", project: "", priority: "Medium" })

    const toggleTask = (id: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
        )
    }

    const addTask = () => {
        if (!newTask.title) return
        setTasks((prev) => [
            ...prev,
            { id: `t${Date.now()}`, ...newTask, due: "TBD", done: false },
        ])
        toast.success("Task added!")
        setSheetOpen(false)
        setNewTask({ title: "", project: "", priority: "Medium" })
    }

    return (
        <div className="p-6 space-y-6">
            {/* Project progress table */}
            <Card>
                <CardHeader>
                    <div>
                        <CardTitle>Active Projects</CardTitle>
                        <CardDescription>Status, progress, and ownership</CardDescription>
                    </div>
                    <CardAction>
                        <Button variant="outline" size="sm" onClick={() => toast.info("Exporting project report…")}>
                            {/* me-* replaces me-* for icon margin on end side */}
                            <Download className="h-3.5 w-3.5 me-1.5" /> Export
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Project</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Due</TableHead>
                                <TableHead>Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasksData.projects.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{p.owner}</TableCell>
                                    <TableCell>
                                        <Badge variant={priorityVariant(p.priority)}>{p.priority}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={projectStatusVariant(p.status as ProjectStatus)}>
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{p.dueDate}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 min-w-[100px]">
                                            <Progress value={p.progress} className="h-1.5 flex-1" />
                                            {/* text-end replaces text-end */}
                                            <span className="text-xs text-muted-foreground w-8 text-end">{p.progress}%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Bottom: radial task status + upcoming checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Task Status</CardTitle>
                        <CardDescription>Distribution across all projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={radialConfig} className="h-56">
                            <RadialBarChart
                                data={tasksData.tasksByStatus}
                                innerRadius={30}
                                outerRadius={90}
                            >
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <RadialBar dataKey="count" fill="var(--color-count)" label={{ position: "insideStart", fill: "#fff", fontSize: 11 }} />
                            </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle>Upcoming Tasks</CardTitle>
                            <CardDescription>Your personal task queue</CardDescription>
                        </div>
                        <CardAction>
                            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button size="sm">Add task</Button>
                                </SheetTrigger>
                                <SheetContent>
                                    <SheetHeader>
                                        <SheetTitle>New task</SheetTitle>
                                        <SheetDescription>Add a task to your queue.</SheetDescription>
                                    </SheetHeader>
                                    <div className="mt-6 space-y-4">
                                        <div className="space-y-1.5">
                                            <Label>Title</Label>
                                            <Input value={newTask.title} onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))} placeholder="Task title" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Project</Label>
                                            <Input value={newTask.project} onChange={(e) => setNewTask((t) => ({ ...t, project: e.target.value }))} placeholder="Project name" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Priority</Label>
                                            <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {["Critical", "High", "Medium", "Low"].map((p) => (
                                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <SheetFooter>
                                        <SheetClose asChild>
                                            <Button variant="outline">Cancel</Button>
                                        </SheetClose>
                                        <Button onClick={addTask} disabled={!newTask.title}>Save task</Button>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-48">
                            {/* pe-* replaces pe-* for logical padding on end side */}
                            <div className="space-y-2 pe-2">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`flex items-start gap-3 rounded-md border px-3 py-2 transition-opacity ${task.done ? "opacity-50" : ""}`}
                                    >
                                        <Checkbox
                                            checked={task.done}
                                            onCheckedChange={() => toggleTask(task.id)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${task.done ? "line-through" : ""}`}>
                                                {task.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{task.project}</p>
                                        </div>
                                        {/* items-end replaces items-end — already logical; gap-0.5 stays */}
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <Badge variant={priorityVariant(task.priority)} className="text-[10px] px-1.5 h-4">
                                                {task.priority}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                <Clock className="h-3 w-3" />{task.due}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ─── PAGE 5: System ────────────────────────────────────────────────────────────

function SystemPage() {
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [notifications, setNotifications] = useState(systemData.notifications)

    const markAllRead = () => {
        setNotifications((n) => n.map((x) => ({ ...x, read: true })))
        toast.success("All notifications marked as read")
    }

    const unreadCount = notifications.filter((n) => !n.read).length

    return (
        <div className="p-6 space-y-6">
            {/* Controls row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
                    <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">Auto-refresh every 30s</Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Refreshing service data…")}>
                    {/* me-* replaces me-* for icon margin on end side */}
                    <RefreshCw className="h-3.5 w-3.5 me-1.5" /> Refresh now
                </Button>
            </div>

            {/* Service health table */}
            <Card>
                <CardHeader>
                    <CardTitle>Service Health</CardTitle>
                    <CardDescription>Real-time status of all infrastructure services</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Service</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Uptime</TableHead>
                                <TableHead>Latency (p99)</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {systemData.health.map((svc) => (
                                <TableRow key={svc.service}>
                                    <TableCell className="font-medium text-sm">{svc.service}</TableCell>
                                    <TableCell>
                                        <Badge variant={serviceStatusVariant(svc.status as ServiceStatus)}>
                                            {svc.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={svc.uptime} className="h-1.5 w-20" />
                                            <span className="text-xs text-muted-foreground">{svc.uptime}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-sm font-mono ${svc.latency > 150 ? "text-destructive" : svc.latency > 80 ? "text-yellow-500" : "text-green-600"}`}>
                                            {svc.latency}ms
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                    <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>View logs for {svc.service}</TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* CPU/Memory area + notification feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>CPU & Memory Usage</CardTitle>
                        <CardDescription>24-hour server resource utilisation</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={cpuConfig} className="h-56">
                            <AreaChart data={systemData.cpuUsage}>
                                <defs>
                                    <linearGradient id="cpu-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-cpu)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-cpu)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="mem-fill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-memory)" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="var(--color-memory)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                                <YAxis domain={[0, 100]} hide />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Area type="monotone" dataKey="cpu" stroke="var(--color-cpu)" fill="url(#cpu-fill)" strokeWidth={2} />
                                <Area type="monotone" dataKey="memory" stroke="var(--color-memory)" fill="url(#mem-fill)" strokeWidth={2} />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Notifications
                                {unreadCount > 0 && (
                                    <Badge className="h-5 text-xs px-1.5">{unreadCount}</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>System alerts and deployment events</CardDescription>
                        </div>
                        <CardAction>
                            <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead} disabled={unreadCount === 0}>
                                Mark all read
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-52">
                            {/* pe-* replaces pe-* for logical padding on end side */}
                            <div className="space-y-2 pe-2">
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${!n.read ? "bg-muted/40 border-primary/20" : ""}`}
                                    >
                                        <span className="mt-0.5 shrink-0">{notifIcon(n.type as NotificationType)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${!n.read ? "" : "text-muted-foreground"}`}>
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{n.message}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{n.time}</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ─── Top Navbar ────────────────────────────────────────────────────────────────

function TopNav({ unread }: { unread: number }) {
    return (
        <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center px-6 gap-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                <span>Matrix Analytics</span>
            </div>

            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Global search */}
            <div className="relative flex-1 max-w-xs">
                {/* start-* replaces start-* for icon positioning inside input */}
                <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                {/* ps-* replaces ps-* for padding on the icon side */}
                <Input className="ps-8 h-8 text-xs bg-muted border-0" placeholder="Search…" />
            </div>

            {/* ms-auto replaces ms-auto for logical margin push */}
            <div className="ms-auto flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-8 w-8">
                            <Bell className="h-4 w-4" />
                            {unread > 0 && (
                                <span className="absolute -top-0.5 -end-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center">
                                    {unread}
                                </span>
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{unread} unread notifications</TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-5" />

                <DropdownMenu>
                    {/* align="end" is already logical in shadcn — no change needed */}
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 gap-2 px-2">
                            <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">HC</AvatarFallback>
                            </Avatar>
                            <span className="text-xs hidden sm:block">Hatim C.</span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-xs">My account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {/* me-* replaces me-* for icon margin inside menu items */}
                        <DropdownMenuItem className="text-xs"><User className="h-3.5 w-3.5 me-2" />Profile</DropdownMenuItem>
                        <DropdownMenuItem className="text-xs"><Settings className="h-3.5 w-3.5 me-2" />Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-destructive"><LogOut className="h-3.5 w-3.5 me-2" />Sign out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export function Dashboard() {
    const unread = systemData.notifications.filter((n) => !n.read).length

    return (
        <div className="min-h-screen bg-background">
            <TopNav unread={unread} />

            <main className="max-w-screen-xl mx-auto">
                <Tabs defaultValue="overview">
                    {/* Sticky tab bar */}
                    <div className="sticky top-14 z-20 bg-background/95 backdrop-blur border-b px-6">
                        <TabsList variant="line" className="h-11 gap-1">
                            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                            <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
                            <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
                            <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
                            <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
                        <OverviewPage />
                    </TabsContent>
                    <TabsContent value="orders" className="mt-0 focus-visible:ring-0">
                        <OrdersPage />
                    </TabsContent>
                    <TabsContent value="team" className="mt-0 focus-visible:ring-0">
                        <TeamPage />
                    </TabsContent>
                    <TabsContent value="projects" className="mt-0 focus-visible:ring-0">
                        <ProjectsPage />
                    </TabsContent>
                    <TabsContent value="system" className="mt-0 focus-visible:ring-0">
                        <SystemPage />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}

export default Dashboard