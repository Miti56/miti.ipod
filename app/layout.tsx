import StyledComponentsRegistry from "@/lib/registry";
import { Metadata, Viewport } from "next";

const getRootAppUrl = () => {
  const isDev = process.env.NODE_ENV === "development";
  const protocol = isDev ? "http" : "https";
  const rootUrl = isDev ? "127.0.0.1:3000" : process.env.VERCEL_BASE_URL;
  return `${protocol}://${rootUrl}`;
};

const appleTouchIconUrl = `${getRootAppUrl()}/apple-touch-icon.png`;
const favicon32Url = `${getRootAppUrl()}/favicon-32x32.png`;
const favicon16Url = `${getRootAppUrl()}/favicon-16x16.png`;

export const metadata: Metadata = {
  title: "Miti's iPod",
  description: "An iPod Classic built for the web.",
  metadataBase: new URL(getRootAppUrl()),
  openGraph: {
    url: getRootAppUrl(),
    title: "Miti's iPod",
    description: "An iPod Classic built for the web.",
    type: "website",
    images: [
      {
        url: "https://user-images.githubusercontent.com/21055469/71636084-6081a800-2be0-11ea-98ee-9599a3396c84.png",
        width: 1200,
        height: 630,
        alt: "Miti's iPod",
      },
    ],
  },
  icons: [
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      url: appleTouchIconUrl,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      url: favicon32Url,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      url: favicon16Url,
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
