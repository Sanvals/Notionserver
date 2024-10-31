const express = require("express");
const cors = require('cors')

const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors())

// Initialize the Notion client with the integration token
const notion = new Client({ auth: process.env.NOTION_TOKEN });

app.get("/", async function (request, response) {
    notion.databases.query({
        database_id: process.env.DATABASE_ID,
        filter: {
            property: "Show",
            checkbox: {
                equals: true
            }
        }
    }).then(res => {
        // Extract URLs from the response
        const links = res.results.map(result => {
            return {
                tag: result.properties.Tags.select.name,
                num: result.properties.Number.number,
                name: result.properties.Name.title[0].text.content,
                url: result.properties.URL.url,
                icon: result.properties.Icon.url
            };
        })
        
        let tagList = links.map(link => link.tag)
        tagList = [...new Set(tagList)].sort();
        const cleanData = {}

        tagList.forEach(tag => {
            links.forEach(link => {
                if (link.tag === tag) {
                    if (cleanData[tag]) {
                        cleanData[tag].push(link)
                    } else {
                        cleanData[tag] = [link]
                    }
                }
            })
            cleanData[tag].sort((a, b) => a.num - b.num)
        })

        // Send the array of URLs as JSON
        response.json(cleanData);

    }).catch(error => {
        console.error("Error querying Notion:", error);
        response.status(500).json({ error: "Failed to fetch data from Notion" });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
