import { Elysia, t } from "elysia";
import { Search, Ingest } from "sonic-channel";
import { swagger } from "@elysiajs/swagger";

const PORT = process.env.PORT || 3333;
const SONIC_PASSWORD = process.env.SONIC_PASSWORD;

const channelIngest = new Ingest({
  host: "localhost",
  port: 1491,
  auth: SONIC_PASSWORD,
});

const channelSearch = new Search({
  host: "localhost",
  port: 1491,
  auth: SONIC_PASSWORD,
});

channelIngest.connect({
  connected: () => {
    console.log("Connected to Sonic Ingest");
  },
  error: (error) => {
    console.error("Error connecting to Sonic Ingest:", error);
  },
});

channelSearch.connect({
  connected: () => {
    console.log("Connected to Sonic Search");
  },
  error: (error) => {
    console.error("Error connecting to Sonic Search:", error);
  },
});

const app = new Elysia()
  .use(swagger({ path: "/api-docs" }))
  .post(
    "/add-product",
    async ({ body, set }) => {
      const { id, title } = body;

      const sanitizedTitle = title.toLowerCase().split(" ").join("-");

      await channelIngest.push(
        "product",
        "default",
        `${id}:${sanitizedTitle}`,
        `id:${id} title:${title}`,
        {
          lang: "por",
        }
      );

      set.status = 204;
    },
    {
      body: t.Object({
        id: t.Number(),
        title: t.String(),
      }),
    }
  )
  .get(
    "/search",
    async ({ query }) => {
      const result = await channelSearch.query("product", "default", query.q, {
        lang: "por",
        limit: 10,
      });

      type Product = {
        id: number;
        title: string;
      };

      const products: Product[] = [];

      for (const strings of result.filter((item) => item.includes(":"))) {
        const [id, title] = strings.split(":");

        const numberId = Number(id);

        if (Number.isNaN(numberId)) continue;

        function capitalizeFirstLetter(value: string): string {
          return value.charAt(0).toUpperCase() + value.slice(1);
        }

        const sanitizedTitle = title
          .replaceAll("-", " ")
          .toLowerCase()
          .split(" ")
          .map(capitalizeFirstLetter)
          .join(" ");

        products.push({ id: numberId, title: sanitizedTitle });
      }

      return products;
    },
    {
      query: t.Object({
        q: t.String(),
      }),
      response: t.Array(t.Object({ id: t.Number(), title: t.String() })),
    }
  );

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
