import ClientLayout from '@/components/ClientLayout';
import './globals.css';

export const metadata = {
  title: 'IntegraSaúde - Gestão Integrada',
  description: 'Sistema de Gestão Municipal de Saúde',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}