'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = () => {
      try {
        const encodedData = searchParams.get('data');

        if (!encodedData) {
          router.push('/');
          return;
        }

        // Décodage base64 côté navigateur, sans dépendance Node (Buffer n'existe pas ici).
        const bytes = Uint8Array.from(atob(encodedData), (char) => char.charCodeAt(0));
        const jsonString = new TextDecoder().decode(bytes);
        const authData = JSON.parse(jsonString);

        window.localStorage.setItem('token', authData.token);
        window.localStorage.setItem('refreshToken', authData.refreshToken);
        window.localStorage.setItem('user', JSON.stringify(authData.user));

        router.push(authData.user?.role === 'teacher' ? '/promotions' : '/my-projects');
      } catch {
        router.push('/');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Connexion réussie !</h2>
        <p className="text-muted-foreground">Redirection en cours…</p>
      </div>
    </div>
  );
}
