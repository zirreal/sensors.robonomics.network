const fs = require("fs");
const path = require("path");

const siteName = "Sensors.social";
const siteUrl = "https://sensors.social";
const defaultImage = siteUrl + "/og-default.webp";

const pages = [
  {
    route: "privacy-policy",
    pageTitle: "Sensors.social Privacy Policy",
    pageDescription: "",
    pageImage: siteUrl + "/og-privacy-policy.webp"
  },
  {
    route: "air-measurements",
    pageTitle: "Air quality measurements information",
    pageDescription: "Sensors.social Air Quality Map — an interactive tool for viewing, analyzing, and comparing real-time air quality data from sensors. Get up-to-date information on air conditions in your area.",
    pageImage: siteUrl + "/og-air-measurements.webp"
  },
    {
    route: "altruist-timeline",
    pageTitle: "7 Years of Altruism - Altruist Timeline",
    pageDescription: "At the end of July 2025, a team of open source developers working on a smart home device ecosystem will present their first product in a planned line of smart home devices for the year — a consumer device called “Altruist”.",
    pageImage: siteUrl + "/og-timeline.webp"
  },
    {
    route: "altruist-use-cases",
    pageTitle: "Who Altruist Was Created For - Sensors use cases",
    pageDescription: "Monitoring the environment involves plenty of pitfalls, making the job far harder than it looks at first glance. Our team—the creators of Altruist and the open-source project sensors.social—has spent seven years studying and working in this field, and we hope our experience will pleasantly surprise you and give you a practical tool for adapting to the conditions in which you and your loved ones live. Below we explain which main user groups Altruist is designed for…",
    pageImage: siteUrl + "/og-altruist-use-cases-all.webp"
  },
];

pages.forEach((page) => {
  const {
    route,
    pageTitle,
    pageDescription = "Robonomics team invite you to use new internet technologies for your IoT devices. This map is open source project with aim to present example of using ipfs, ethereum and polkadot tech for Smart cities applications developers.",
    pageImage = defaultImage,
    pageImageWidth = "1280",
    pageImageHeight = "765"
  } = page;

  const title = pageTitle ? `${pageTitle} / ${siteName}` : siteName;
  const fullUrl = `${siteUrl}/${route}/`;

  const html = `
<!DOCTYPE html>
<html lang="en" amp dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${pageDescription}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${pageDescription}" />
  <meta property="og:image" content="${pageImage}" />
  <meta property="og:image:width" content="${pageImageWidth}" />
  <meta property="og:image:height" content="${pageImageHeight}" />
  <meta property="og:url" content="${fullUrl}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${pageDescription}" />
  <meta name="twitter:image" content="${pageImage}" />
  <meta name="twitter:site" content="@AIRA_Robonomics" />
  <meta name="twitter:creator" content="@AIRA_Robonomics" />

  <!-- Redirect to hash-based route -->
  <meta http-equiv="refresh" content="0; url=/#/${route}/" />
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>
`.trim();

  const dir = path.join("dist", route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
});
