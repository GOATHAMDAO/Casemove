import axios from "axios";
import { createCSGOImage } from "../../functionsClasses/createCSGOImage";

export async function getURL(steamID: string): Promise<string> {
    const defaultReturnString = createCSGOImage("econ/characters/customplayer_tm_separatist");

    try {
        const response = await axios.get(`https://steamcommunity.com/profiles/${steamID}/?xml=1`);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.data, "text/xml");
        const avatarMediumElement = xmlDoc.getElementsByTagName("profile")[0]?.getElementsByTagName("avatarMedium")[0];
        const nodeValue = avatarMediumElement?.childNodes[0]?.nodeValue;

        return nodeValue || defaultReturnString;
    } catch (error) {
        console.error("Error fetching Steam profile:", error);
        return defaultReturnString;
    }
}
