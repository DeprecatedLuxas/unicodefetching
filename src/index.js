require('dotenv').config();
const { request } = require("@octokit/request");
const axios = require('axios');
const blockFileUrl = "https://www.unicode.org/Public/UCD/latest/ucd/Blocks.txt";
const moment = require('moment');


async function getLatestFileContents() {
    const { data } = await axios.get("https://raw.githubusercontent.com/DeprecatedLuxas/unicodeblocks/master/latest.json");
    return data;
}

async function getLatestUnicodeUpdateFromWebsite() {
    const { data } = await axios.get(blockFileUrl);
    return data;
}

function destroyUnicodeReturnResponse(fileContent) {
    const textInArray = fileContent.split("\n");
    let unicodeObject = {
        "blocks": []
    }
    let splittedLine;
    textInArray.forEach(txt => {
        const splittedTxt = txt.split("; ");
        if (splittedTxt[0].match(/^[a-zA-Z0-9_.-]*$/)) {
            splittedLine = splittedTxt[0].split("..");
            if (splittedLine[0] === '') return;
            unicodeObject.blocks.push({
                name: splittedTxt[1],
                start: splittedLine[0],
                end: splittedLine[1]
            });
        } 
    });
    return unicodeObject;
}

async function createNewUnicodeBlockInRepo(currentTime, unicodeBlock) {
    
    try {
        return await request("PUT /repos/{owner}/{repo}/contents/{path}", {
            headers: {
              authorization: `token ${process.env.GITHUB_TOKEN}`,
            },
            owner: "DeprecatedLuxas",
            repo: "unicodeblocks",
            path: `${currentTime}/block.json`,
            message: "Added a new unicode block to the repo.",
            content: Buffer.from(JSON.stringify(unicodeBlock, null, 4)).toString('base64')
          });
    } catch (exception) {
        console.error(exception);
    }
}

function createLatestFileObj(blockFolder, lastUpdate) {
    return {
        "latestBlockFolder": blockFolder,
        "lastUpdate": lastUpdate
    }
}
async function getLatestSha() {
    const { data } = await axios.get("https://api.github.com/repos/deprecatedluxas/unicodeblocks/contents/latest.json");
    return data.sha;
}


async function updateLatestFile(fileObj) {
    const sha = await getLatestSha();
    try {
        const result = await request("PUT /repos/{owner}/{repo}/contents/{path}", {
            headers: {
                authorization: `token ${process.env.GITHUB_TOKEN}`,
              },
              owner: "DeprecatedLuxas",
              repo: "unicodeblocks",
              sha: sha,
              path: 'latest.json',
              message: "Updated latest.json with the new values.",
              content: Buffer.from(JSON.stringify(fileObj, null, 4)).toString('base64')   
        });
        console.log(result)
    } catch (exception) {
        console.error(exception)
    }
}





async function run() {
    const { latestBlockFolder, lastUpdate } = await getLatestFileContents();
    let fileContents = await getLatestUnicodeUpdateFromWebsite();

    const splittedFileContent = fileContents.split("\n")[1]; // Split the file contents.
    const formattedDate = splittedFileContent.replace("#", "").replace("[KW]", "").trim().split(": ")[1]; // Take only the important data.

    if (moment(lastUpdate, "YYYY-MM-DD, hh:mm:ss").isBefore(moment(formattedDate, "YYYY-MM-DD, hh:mm:ss"))) {
        const unicodeObject = destroyUnicodeReturnResponse(fileContents);
        if (unicodeObject !== undefined) {
            const currentTime = moment().unix();
            await createNewUnicodeBlockInRepo(currentTime, unicodeObject);
            await updateLatestFile(createLatestFileObj(currentTime + "/block.json", formattedDate));
            return;
        } else {
            console.log("Unicode Object was not built correctly.")
        }
    } else {
        console.log("There was no update.")
    }

}
run();