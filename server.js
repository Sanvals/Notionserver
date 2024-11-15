const express = require("express");
const cors = require('cors');
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

let currentUrl = "";
let currentData = {};
let validUrls = [];

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

// Store all the urls from notion page into valudUrls
async function initializeValidUrls() {
    try {
        const results = await fetchAllPages();

        // Process and store the valid URLs
        validUrls = results
            .map(result => result.properties.URL?.url || "")
            .filter(url => url !== ""); // Ensure no empty URLs
    } catch (error) {
        console.error("Error initializing valid URLs:", error);
    }
}

/*
    Enpoints:
    / - Gets links from notion and stores on 'currentData'
    /refreshData - Gets info from 'currentData'
    /empty - Empties currentUrl
    /set_url/:url - Validates and sets currentUrl
    /get_url - Gets the currentUrl
*/

app.get("/", (request, response) => {
    response.json(currentData);
})


app.get("/refreshData", async (request, response) => {
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
                currentData = sortedAcc;
                return sortedAcc;
            }, {});

        // Send the organized and sorted data as JSON
        initializeValidUrls();
        response.json(sortedCleanData);
    } catch (error) {
        console.error("Error processing request:", error);
        response.status(500).json({ error: "Failed to process data" });
    }
});


app.get("/empty", (request, response) => {
    currentUrl = "";
    response.json({ message: "Link emptied" });
})


app.get("/set_url/:url", (request, response) => {
    const requestedUrl = decodeURIComponent(request.params.url);
    const checker = validUrls.includes('https://' + requestedUrl)
    if (checker) {
        currentUrl = requestedUrl;
        response.json({ message: "URL set", url: requestedUrl });
    } else {
        response.status(400).json({ error: "Invalid URL" });
    }
})


app.get("/get_url", (request, response) => {
    response.json({ url: currentUrl });
})


app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
