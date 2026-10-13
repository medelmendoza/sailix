import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { routes } from './app/router/routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
