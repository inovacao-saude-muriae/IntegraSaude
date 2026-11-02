import ClientLayout from '@/components/ClientLayout';
import './globals.css';

export const metadata = {
  title: 'IntegraSaúde - Gestão Integrada',
  description: 'Sistema de Gestão Municipal de Saúde',
  icons: {
    icon: '/img/logos-integra/icon.png',
    shortcut: '/img/logos-integra/icon.png',
    apple: '/img/logos-integra/icon.png',
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