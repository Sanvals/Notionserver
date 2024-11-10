const express = require("express");
const cors = require('cors');
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Function to fetch all pages from the Notion database
async function fetchAllPages() {
    let results = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
        try {
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

            // Append results and update cursor for next fetch
            results = results.concat(response.results);
            hasMore = response.has_more;
            startCursor = response.next_cursor;
        } catch (error) {
            console.error("Error querying Notion during pagination:", error);
            throw new Error("Failed to fetch all data from Notion");
        }
    }

    return results;
}

app.get("/", async (request, response) => {
    try {
        const results = await fetchAllPages();

        // Group and sort links by tags using reduce
        const cleanData = results.reduce((acc, result) => {
            const { Tags, Number, Name, URL, Icon } = result.properties;

            const tag = Tags?.select?.name || "Uncategorized";
            const link = {
                tag,
                num: Number?.number || 0,
                name: Name?.title[0]?.text?.content || "Untitled",
                url: URL?.url || "",
                icon: Icon?.url || ""
            };

            if (!acc[tag]) acc[tag] = [];
            acc[tag].push(link);

            return acc;
        }, {});

        // Sort each tag group by the `num` property
        Object.keys(cleanData).forEach(tag => {
            cleanData[tag].sort((a, b) => a.num - b.num);
        });

        // Create a sorted version of cleanData by tag names
        const sortedCleanData = Object.keys(cleanData)
            .sort((a, b) => a.localeCompare(b)) // Alphabetically sort the tag names
            .reduce((sortedAcc, tag) => {
                sortedAcc[tag] = cleanData[tag];
                return sortedAcc;
            }, {});

        // Send the organized and sorted data as JSON
        response.json(sortedCleanData);
    } catch (error) {
        console.error("Error processing request:", error);
        response.status(500).json({ error: "Failed to process data" });
    }
});

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
