// app/music/say-yes/page.tsx
import { Suspense } from "react";
import ClientPage from "./ClientPage";

export default function SayYesRoutePage() {
  return (
    <Suspense fallback={null}>
      <ClientPage />
    </Suspense>
  );
}
