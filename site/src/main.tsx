import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import 'highlight.js/styles/github-dark.css'
import { Landing } from './pages/Landing'
import { Docs } from './pages/Docs'
import { Layout } from './components/Layout'

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/docs', element: <Docs /> },
      { path: '/docs/:page', element: <Docs /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
