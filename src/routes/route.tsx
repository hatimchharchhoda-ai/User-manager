import { createBrowserRouter } from "react-router-dom"

import Dashboard from "@/pages/dashboard"
import UserCreation from "@/pages/userCreation"
import StreamPage from "@/pages/stream"

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Dashboard />,
    },
    {
        path: "users",
        element: <UserCreation />,
    },
    {
        path: '/stream',
        element: <StreamPage />
    }
])