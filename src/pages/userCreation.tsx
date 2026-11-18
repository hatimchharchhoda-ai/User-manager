/**
 * CreateUserPage.tsx
 *
 * Multi-step user creation form — 7 sections, fully wired with local state.
 * Uses only components available in the @sansar registry (same imports as
 * UIPrimitivePage / BusinessDashboard).
 *
 * Steps:
 *  1. Basic Information
 *  2. Contact Information
 *  3. Address
 *  4. Employment Details
 *  5. Account & Access
 *  6. Documents
 *  7. Additional Information
 */

import { useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Contact,
  FileText,
  Globe,
  Info,
  KeyRound,
  MapPin,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react"
import { toast } from "sonner"
import options from "../data/userCreationData/Userformoptions.json"

// ─── Static option data (sourced from userFormOptions.json) ───────────────────

const GENDERS          = options.genders
const MARITAL_STATUSES = options.maritalStatuses
const BLOOD_GROUPS     = options.bloodGroups
const DEPARTMENTS      = options.departments
const EMPLOYMENT_TYPES = options.employmentTypes
const WORK_LOCATIONS   = options.workLocations
const ROLES            = options.roles
const PERMISSIONS      = options.permissions
const COUNTRIES        = options.countries
const STATES           = options.statesByCountry as Record<string, string[]>
const CITIES           = options.citiesByState   as Record<string, string[]>
const DESIGNATIONS     = options.designations
const SKILLS_LIST      = options.skills
const LANGUAGES        = options.languages
const HOBBIES          = options.hobbies

// ─── Step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Basic Info", icon: User },
  { id: 2, label: "Contact", icon: Contact },
  { id: 3, label: "Address", icon: MapPin },
  { id: 4, label: "Employment", icon: Briefcase },
  { id: 5, label: "Account", icon: KeyRound },
  { id: 6, label: "Documents", icon: FileText },
  { id: 7, label: "Additional", icon: Sparkles },
]

// ─── Reusable field wrapper ────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── Combobox ─────────────────────────────────────────────────────────────────

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onChange(opt); setOpen(false) }}
                >
                  <Check className={`me-2 h-4 w-4 ${value === opt ? "opacity-100" : "opacity-0"}`} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Multi-select Combobox ────────────────────────────────────────────────────

function MultiCombobox({
  options,
  values,
  onChange,
  placeholder = "Select…",
}: {
  options: string[]
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt])

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            {values.length === 0
              ? <span className="text-muted-foreground">{placeholder}</span>
              : <span>{values.length} selected</span>}
            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                    <Check className={`me-2 h-4 w-4 ${values.includes(opt) ? "opacity-100" : "opacity-0"}`} />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pe-1">
              {v}
              <button onClick={() => toggle(v)} className="rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  value: Date | undefined
  onChange: (d: Date | undefined) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon className="me-2 h-4 w-4 text-muted-foreground" />
          {value
            ? value.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => { onChange(d); setOpen(false) }}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── File Upload Field ────────────────────────────────────────────────────────

function FileUploadField({
  label,
  accept,
  value,
  onChange,
  progress,
}: {
  label: string
  accept: string
  value: File | null
  onChange: (f: File | null) => void
  progress: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => ref.current?.click()}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {value ? value.name : `Upload ${label}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{accept.replace(/,/g, ", ")}</p>
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            onChange(file)
            if (file) toast.info(`${file.name} selected`)
          }}
        />
      </div>
      {value && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </div>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormData = {
  // 1. Basic
  avatarUrl: string
  firstName: string
  middleName: string
  lastName: string
  dob: Date | undefined
  gender: string
  maritalStatus: string
  bloodGroup: string
  // 2. Contact
  email: string
  phone: string
  altPhone: string
  website: string
  linkedin: string
  twitter: string
  // 3. Address
  address1: string
  address2: string
  country: string
  state: string
  city: string
  zip: string
  // 4. Employment
  employeeId: string
  department: string
  designation: string
  joiningDate: Date | undefined
  employmentType: string
  workLocation: string
  skills: string[]
  // 5. Account
  username: string
  accountEmail: string
  password: string
  confirmPassword: string
  role: string
  permissions: string[]
  twoFactor: boolean
  accountActive: boolean
  // 6. Documents
  photoFile: File | null
  resumeFile: File | null
  idFile: File | null
  // 7. Additional
  bio: string
  notes: string
  languages: string[]
  hobbies: string[]
}

const initialForm: FormData = {
  avatarUrl: "",
  firstName: "", middleName: "", lastName: "",
  dob: undefined, gender: "", maritalStatus: "", bloodGroup: "",
  email: "", phone: "", altPhone: "", website: "", linkedin: "", twitter: "",
  address1: "", address2: "", country: "", state: "", city: "", zip: "",
  employeeId: "", department: "", designation: "",
  joiningDate: undefined, employmentType: "", workLocation: "", skills: [],
  username: "", accountEmail: "", password: "", confirmPassword: "",
  role: "", permissions: [], twoFactor: false, accountActive: true,
  photoFile: null, resumeFile: null, idFile: null,
  bio: "", notes: "", languages: [], hobbies: [],
}

// ─── Step panels ──────────────────────────────────────────────────────────────

function StepBasic({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const initials = [form.firstName[0], form.lastName[0]].filter(Boolean).join("").toUpperCase()

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-20 w-20">
          {form.avatarUrl
            ? <AvatarImage src={form.avatarUrl} />
            : <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {initials || <User className="h-8 w-8" />}
              </AvatarFallback>}
        </Avatar>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium">Profile Photo</p>
          <p className="text-xs text-muted-foreground">Preview from URL below</p>
        </div>
        <Input
          className="max-w-sm text-xs"
          placeholder="Paste image URL (optional)"
          value={form.avatarUrl}
          onChange={(e) => set("avatarUrl", e.target.value)}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="First Name" required>
          <Input placeholder="e.g. Hatim" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Middle Name">
          <Input placeholder="e.g. Abc" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </Field>
        <Field label="Last Name" required>
          <Input placeholder="e.g. Xyz" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Date of Birth">
          <DatePicker value={form.dob} onChange={(d) => set("dob", d)} placeholder="Select birth date" />
        </Field>
        <Field label="Gender">
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Marital Status">
          <Select value={form.maritalStatus} onValueChange={(v) => set("maritalStatus", v)}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Blood Group">
          <Select value={form.bloodGroup} onValueChange={(v) => set("bloodGroup", v)}>
            <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  )
}

function StepContact({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Email Address" required>
          <Input type="email" placeholder="hatim@matrixcomsec.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone Number" required>
          <div className="flex gap-2">
            <Select defaultValue="+91">
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.phoneCountryCodes.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="98765 43210" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </Field>
        <Field label="Alternate Phone">
          <Input placeholder="Optional" value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} />
        </Field>
        <Field label="Personal Website">
          <div className="relative">
            <Globe className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="ps-8" type="url" placeholder="https://yoursite.com" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        </Field>
      </div>

      <Separator />
      <p className="text-sm font-medium text-muted-foreground">Social Links</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="LinkedIn">
          <div className="relative">
            <Input className="ps-8" placeholder="linkedin.com/in/username" value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
          </div>
        </Field>
        <Field label="Twitter / X">
          <div className="relative">
            <Input className="ps-8" placeholder="@username" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
          </div>
        </Field>
      </div>
    </div>
  )
}

function StepAddress({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const stateOptions = form.country ? (STATES[form.country] ?? []) : []
  const cityOptions = form.state ? (CITIES[form.state] ?? []) : []

  return (
    <div className="space-y-4">
      <Field label="Address Line 1" required>
        <Textarea
          placeholder="House / Flat No, Street, Area"
          rows={2}
          value={form.address1}
          onChange={(e) => set("address1", e.target.value)}
        />
      </Field>
      <Field label="Address Line 2">
        <Input placeholder="Landmark, Locality (optional)" value={form.address2} onChange={(e) => set("address2", e.target.value)} />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Country" required>
          <Combobox
            options={COUNTRIES}
            value={form.country}
            onChange={(v) => { set("country", v); set("state", ""); set("city", "") }}
            placeholder="Select country"
          />
        </Field>
        <Field label="State">
          <Combobox
            options={stateOptions}
            value={form.state}
            onChange={(v) => { set("state", v); set("city", "") }}
            placeholder={form.country ? "Select state" : "Select country first"}
            disabled={!form.country}
          />
        </Field>
        <Field label="City">
          <Combobox
            options={cityOptions}
            value={form.city}
            onChange={(v) => set("city", v)}
            placeholder={form.state ? "Select city" : "Select state first"}
            disabled={!form.state}
          />
        </Field>
        <Field label="ZIP / Postal Code">
          <Input placeholder="e.g. 382110" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

function StepEmployment({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Employee ID" hint="Leave blank to auto-generate">
          <Input placeholder="EMP-0001" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} />
        </Field>
        <Field label="Department" required>
          <Select value={form.department} onValueChange={(v) => set("department", v)}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Designation" required>
          <Combobox
            options={DESIGNATIONS}
            value={form.designation}
            onChange={(v) => set("designation", v)}
            placeholder="Select or search designation"
          />
        </Field>
        <Field label="Joining Date">
          <DatePicker value={form.joiningDate} onChange={(d) => set("joiningDate", d)} placeholder="Select joining date" />
        </Field>
        <Field label="Work Location">
          <Select value={form.workLocation} onValueChange={(v) => set("workLocation", v)}>
            <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              {WORK_LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Employment Type" required>
        <div className="flex flex-wrap gap-2 pt-1">
          {EMPLOYMENT_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              variant={form.employmentType === type ? "default" : "outline"}
              size="sm"
              onClick={() => set("employmentType", type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </Field>

      <Field label="Skills" hint="Select one or more skills">
        <MultiCombobox
          options={SKILLS_LIST}
          values={form.skills}
          onChange={(v) => set("skills", v)}
          placeholder="Search and select skills…"
        />
      </Field>
    </div>
  )
}

function StepAccount({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  const [showPwd, setShowPwd] = useState(false)
  const pwdMatch = form.password && form.confirmPassword && form.password !== form.confirmPassword

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Username" required>
          <Input placeholder="hatim_c" value={form.username} onChange={(e) => set("username", e.target.value)} />
        </Field>
        <Field label="Account Email" required>
          <Input type="email" placeholder="hatim@matrixcomsec.com" value={form.accountEmail} onChange={(e) => set("accountEmail", e.target.value)} />
        </Field>
        <Field label="Password" required>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <button
              type="button"
              className="absolute end-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowPwd((s) => !s)}
            >
              {showPwd ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <Field label="Confirm Password" required>
          <Input
            type="password"
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
          />
        </Field>
      </div>

      {pwdMatch && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Passwords do not match.</AlertDescription>
        </Alert>
      )}

      <Field label="Role" required>
        <Select value={form.role} onValueChange={(v) => set("role", v)}>
          <SelectTrigger><SelectValue placeholder="Assign a role" /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Permissions">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {PERMISSIONS.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Checkbox
                id={p.id}
                checked={form.permissions.includes(p.id)}
                onCheckedChange={(checked) =>
                  set("permissions", checked
                    ? [...form.permissions, p.id]
                    : form.permissions.filter((x) => x !== p.id))
                }
              />
              <Label htmlFor={p.id} className="text-sm cursor-pointer">{p.label}</Label>
            </div>
          ))}
        </div>
      </Field>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground">Require OTP on every login</p>
          </div>
          <Switch
            checked={form.twoFactor}
            onCheckedChange={(v) => set("twoFactor", v)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Account Active</p>
            <p className="text-xs text-muted-foreground">User can log in immediately after creation</p>
          </div>
          <Switch
            checked={form.accountActive}
            onCheckedChange={(v) => set("accountActive", v)}
          />
        </div>
      </div>
    </div>
  )
}

function StepDocuments({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  // Simulate upload progress when file is selected
  const [progress, setProgress] = useState({ photo: 0, resume: 0, id: 0 })

  const handleFile = (key: "photoFile" | "resumeFile" | "idFile", progressKey: "photo" | "resume" | "id", file: File | null) => {
    set(key, file)
    if (!file) return
    setProgress((p) => ({ ...p, [progressKey]: 0 }))
    let v = 0
    const t = setInterval(() => {
      v += Math.floor(Math.random() * 20) + 10
      if (v >= 100) { v = 100; clearInterval(t) }
      setProgress((p) => ({ ...p, [progressKey]: v }))
    }, 200)
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Accepted formats and size limits apply. Files are stored securely and only accessible to authorized personnel.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Field label="Profile Photo">
          <FileUploadField
            label="Profile Photo"
            accept=".jpg,.jpeg,.png,.webp"
            value={form.photoFile}
            onChange={(f) => handleFile("photoFile", "photo", f)}
            progress={progress.photo}
          />
        </Field>
        <Field label="Resume / CV">
          <FileUploadField
            label="Resume"
            accept=".pdf,.doc,.docx"
            value={form.resumeFile}
            onChange={(f) => handleFile("resumeFile", "resume", f)}
            progress={progress.resume}
          />
        </Field>
        <Field label="ID Proof">
          <FileUploadField
            label="ID Proof"
            accept=".jpg,.jpeg,.png,.pdf"
            value={form.idFile}
            onChange={(f) => handleFile("idFile", "id", f)}
            progress={progress.id}
          />
        </Field>
      </div>
    </div>
  )
}

function StepAdditional({ form, set }: { form: FormData; set: (k: keyof FormData, v: unknown) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Bio" hint="A short professional summary">
        <Textarea
          placeholder="Write a brief bio…"
          rows={4}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
        />
      </Field>
      <Field label="Internal Notes" hint="Visible only to HR and Admins">
        <Textarea
          placeholder="Any internal notes about this user…"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Languages Known">
          <MultiCombobox
            options={LANGUAGES}
            values={form.languages}
            onChange={(v) => set("languages", v)}
            placeholder="Select languages…"
          />
        </Field>
        <Field label="Hobbies & Interests">
          <MultiCombobox
            options={HOBBIES}
            values={form.hobbies}
            onChange={(v) => set("hobbies", v)}
            placeholder="Select hobbies…"
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Review summary ────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  )
}

function ReviewSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="ps-6 space-y-1.5 border-l border-border ms-2">{children}</div>
    </div>
  )
}

function StepReview({ form }: { form: FormData }) {
  return (
    <ScrollArea className="h-[420px] pe-2">
      <div className="space-y-6 pe-2">
        <ReviewSection title="Basic Information" icon={User}>
          <ReviewRow label="Full Name" value={[form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ")} />
          <ReviewRow label="Date of Birth" value={form.dob?.toLocaleDateString()} />
          <ReviewRow label="Gender" value={form.gender} />
          <ReviewRow label="Marital Status" value={form.maritalStatus} />
          <ReviewRow label="Blood Group" value={form.bloodGroup} />
        </ReviewSection>

        <ReviewSection title="Contact" icon={Contact}>
          <ReviewRow label="Email" value={form.email} />
          <ReviewRow label="Phone" value={form.phone} />
          <ReviewRow label="Website" value={form.website} />
          <ReviewRow label="LinkedIn" value={form.linkedin} />
        </ReviewSection>

        <ReviewSection title="Address" icon={MapPin}>
          <ReviewRow label="Address" value={[form.address1, form.address2].filter(Boolean).join(", ")} />
          <ReviewRow label="City / State" value={[form.city, form.state, form.country].filter(Boolean).join(", ")} />
          <ReviewRow label="ZIP" value={form.zip} />
        </ReviewSection>

        <ReviewSection title="Employment" icon={Briefcase}>
          <ReviewRow label="Employee ID" value={form.employeeId || "Auto-generate"} />
          <ReviewRow label="Department" value={form.department} />
          <ReviewRow label="Designation" value={form.designation} />
          <ReviewRow label="Type" value={form.employmentType} />
          <ReviewRow label="Location" value={form.workLocation} />
          {form.skills.length > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground w-36 shrink-0">Skills</span>
              <div className="flex flex-wrap gap-1">
                {form.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
              </div>
            </div>
          )}
        </ReviewSection>

        <ReviewSection title="Account & Access" icon={KeyRound}>
          <ReviewRow label="Username" value={form.username} />
          <ReviewRow label="Email" value={form.accountEmail} />
          <ReviewRow label="Role" value={form.role} />
          <ReviewRow label="2FA" value={form.twoFactor ? "Enabled" : "Disabled"} />
          <ReviewRow label="Status" value={form.accountActive ? "Active" : "Inactive"} />
          {form.permissions.length > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground w-36 shrink-0">Permissions</span>
              <div className="flex flex-wrap gap-1">
                {form.permissions.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {PERMISSIONS.find((x) => x.id === p)?.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </ReviewSection>

        <ReviewSection title="Additional" icon={Sparkles}>
          {form.bio && <ReviewRow label="Bio" value={form.bio.slice(0, 120) + (form.bio.length > 120 ? "…" : "")} />}
          {form.languages.length > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground w-36 shrink-0">Languages</span>
              <span>{form.languages.join(", ")}</span>
            </div>
          )}
          {form.hobbies.length > 0 && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground w-36 shrink-0">Hobbies</span>
              <span>{form.hobbies.join(", ")}</span>
            </div>
          )}
        </ReviewSection>
      </div>
    </ScrollArea>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function UserCreation() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitted, setSubmitted] = useState(false)

  const totalSteps = STEPS.length
  const isReview = step === totalSteps + 1

  const set = (key: keyof FormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = () => {
    toast.success(`User ${form.firstName} ${form.lastName} created successfully!`)
    setSubmitted(true)
  }

  const handleReset = () => {
    setForm(initialForm)
    setStep(1)
    setSubmitted(false)
  }

  if (submitted) {
    const initials = [form.firstName[0], form.lastName[0]].filter(Boolean).join("").toUpperCase()
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <Avatar className="h-20 w-20 mx-auto">
              {form.avatarUrl
                ? <AvatarImage src={form.avatarUrl} />
                : <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>}
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{form.firstName} {form.lastName}</h2>
              <p className="text-sm text-muted-foreground">{form.designation} · {form.department}</p>
            </div>
            <Badge variant="default" className="mx-auto">
              {form.accountActive ? "Active" : "Inactive"} · {form.role}
            </Badge>
            <p className="text-sm text-muted-foreground">User account has been created successfully.</p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleReset}>Create another</Button>
              <Button onClick={() => toast.info("Redirecting to user list…")}>
                View all users
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stepContent: Record<number, React.ReactNode> = {
    1: <StepBasic form={form} set={set} />,
    2: <StepContact form={form} set={set} />,
    3: <StepAddress form={form} set={set} />,
    4: <StepEmployment form={form} set={set} />,
    5: <StepAccount form={form} set={set} />,
    6: <StepDocuments form={form} set={set} />,
    7: <StepAdditional form={form} set={set} />,
    8: <StepReview form={form} />,
  }

  const currentLabel = isReview ? "Review & Submit" : STEPS[step - 1]?.label

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Create User</h1>
            <p className="text-sm text-muted-foreground">
              Step {Math.min(step, totalSteps + 1)} of {totalSteps + 1} — {currentLabel}
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <Progress value={(step / (totalSteps + 1)) * 100} className="h-1.5" />

        {/* Step pills */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2 min-w-max">
            {STEPS.map((s) => {
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => step > s.id && setStep(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : done
                      ? "bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20"
                      : "text-muted-foreground border-border cursor-default"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {s.label}
                </button>
              )
            })}
            <button
              onClick={() => step > totalSteps && setStep(totalSteps + 1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isReview
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border cursor-default"
              }`}
            >
              <Building2 className="h-3 w-3" />
              Review
            </button>
          </div>
        </ScrollArea>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {!isReview && (() => { const Icon = STEPS[step - 1]?.icon; return Icon ? <Icon className="h-4 w-4 text-primary" /> : null })()}
              {currentLabel}
            </CardTitle>
            <CardDescription>
              {isReview
                ? "Review all information before creating the user account."
                : `Fill in the ${currentLabel?.toLowerCase()} details below.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stepContent[step]}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 me-1" /> Back
          </Button>

          <div className="flex gap-2">
            {!isReview ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                {step === totalSteps ? "Review" : "Continue"}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Check className="h-4 w-4 me-1" /> Create User
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default UserCreation