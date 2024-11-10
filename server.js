const express = require("express");
const cors = require('cors');
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());

// Initialize the Notion client with the integration token
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Function to fetch all pages from the Notion database
async function fetchAllPages() {
    let results = [];
    let hasMore = true;
    let startCursor = undefined;

    // Loop to handle pagination
    while (hasMore) {
        const response = await notion.databases.query({
            database_id: process.env.DATABASE_ID,
            filter: {
                property: "Show",
                checkbox: {
                    equals: true
                }
            },
            start_cursor: startCursor
        });

        // Collect the results
        results = results.concat(response.results);

        // Check if there are more pages
        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    return results;
}

app.get("/", async function (request, response) {
    try {
        const results = await fetchAllPages();

        // Extract URLs from the response
        const links = results.map(result => {
            return {
                tag: result.properties.Tags.select.name,
                num: result.properties.Number.number,
                name: result.properties.Name.title[0].text.content,
                url: result.properties.URL.url,
                icon: result.properties.Icon.url
            };
        });
        console.log(links.length)

        // Create a list of unique tags
        let tagList = links.map(link => link.tag);
        tagList = [...new Set(tagList)].sort();

        // Organize links by tag
        const cleanData = {};

        tagList.forEach(tag => {
            cleanData[tag] = links
                .filter(link => link.tag === tag)
                .sort((a, b) => a.num - b.num);
        });

        // Send the organized data as JSON
        response.json(cleanData);
    } catch (error) {
        console.error("Error querying Notion:", error);
        response.status(500).json({ error: "Failed to fetch data from Notion" });
    }
});

app.listen(port, () => {
    console.log(`Server running at ${port || 3000}`);
});
