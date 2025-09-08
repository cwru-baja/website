// ULTIMATE SPONSORS
import fox from '../assets/logo/sponsor/fox-logo.png';
import bmt from '../assets/logo/sponsor/svg/bmt-aerospace.svg';
import enterline from '../assets/logo/sponsor/svg/enterline-foundation.svg';
import stifel from '../assets/logo/sponsor/svg/stifel.svg';
import caseAlumniAssociation from '../assets/logo/sponsor/svg/case-alumni-association.svg';

// PLATINUM SPONSORS
import speedMetals from '../assets/logo/sponsor/svg/spee-d-metals.svg';
import siemens from '../assets/logo/sponsor/svg/siemens.svg';
import skbCases from '../assets/logo/sponsor/skb-cases.png';
import kenesto from '../assets/logo/sponsor/svg/kenesto.svg';
import altair from '../assets/logo/sponsor/svg/altair.svg';
import kissoft from '../assets/logo/sponsor/svg/kissoft.svg';

// GOLD SPONSORS
import jergens from '../assets/logo/sponsor/svg/jergens.svg';
import bwxt from '../assets/logo/sponsor/svg/bwxt.svg';
import gmnBearing from '../assets/logo/sponsor/svg/gmn-bearing.svg';
import skf from '../assets/logo/sponsor/svg/skf.svg';
import magna from '../assets/logo/sponsor/svg/magna.svg';
import ansys from '../assets/logo/sponsor/svg/ansys.svg';
import skamar from '../assets/logo/sponsor/svg/skamar.svg';
import haas from '../assets/logo/sponsor/svg/gene-haas-foundation.svg';
import clevelandCliffs from '../assets/logo/sponsor/cleveland-cliffs-logo.png';
import misaMetal from '../assets/logo/sponsor/misa-metal.png';
import solidWorks from '../assets/logo/sponsor/solidworks_logo.png';
import parker from '../assets/logo/sponsor/svg/parker.svg';
import tylok from '../assets/logo/sponsor/svg/tylok.svg';

// SILVER SPONSORS
import gmp from '../assets/logo/sponsor/svg/gmp-friction.svg';
import sgs from '../assets/logo/sponsor/svg/sgs.svg';
import thinkbox from '../assets/logo/sponsor/svg/thinkbox.svg';
import michiganScientific from '../assets/logo/sponsor/svg/michigan-scientific.svg';
import mastercam from '../assets/logo/sponsor/svg/mastercam.svg';
import blaser from '../assets/logo/sponsor/svg/blaser-swisslube.svg';
import automationDirect from '../assets/logo/sponsor/svg/automation-direct.svg';
import americanFriction from '../assets/logo/sponsor/svg/american-friction-technologies.svg';
import clark from '../assets/logo/sponsor/svg/clark.svg';
import asi from '../assets/logo/sponsor/svg/asi.svg';
import schunk from '../assets/logo/sponsor/svg/schunk.svg';
import summitRacing from '../assets/logo/sponsor/summit-racing-logo.png';

// BRONZE SPONSORS
import nordlock from '../assets/logo/sponsor/svg/nord-lock-group.svg';
import southington from '../assets/logo/sponsor/svg/southington.svg';
import ptg from '../assets/logo/sponsor/svg/ptg.svg';
import boltDepot from '../assets/logo/sponsor/svg/bolt-depot.svg';
import fkRodEnds from '../assets/logo/sponsor/svg/fk-rod-ends.svg';
import alro from '../assets/logo/sponsor/svg/alro.svg';
import fathomRealty from '../assets/logo/sponsor/fathom-logo.png';
import gates from '../assets/logo/sponsor/gates-logo.png';
import microMeasurements from '../assets/logo/sponsor/micro-measurements-logo.png';
import oshCut from '../assets/logo/sponsor/oshcut-logo.png';
import stampedeDie from '../assets/logo/sponsor/stampede-die-logo.png';
import zintilon from '../assets/logo/sponsor/svg/zintilon.svg';
import nsk from '../assets/logo/sponsor/nsk-logo.png';
import commercialSteelTreating from '../assets/logo/sponsor/commercial-steel-logo.png';
import tmacMachine from '../assets/logo/sponsor/tmac-machine-logo.png';
import ppg from '../assets/logo/sponsor/ppg-logo.png';

export interface Sponsor {
    name: string;
    logo: string;
    url: string;
}

export const sponsors = {
    ultimate: [
        { name: "Fox", logo: fox, url: "https://ridefox.com/" },
        { name: "BMT Aerospace", logo: bmt, url: "https://bmtaerospace.com/" },
        { name: "Enterline Foundation", logo: enterline, url: "https://enterlinefoundation.org/" },
        { name: "Stifel", logo: stifel, url: "https://www.stifel.com/" },
        { name: "Case Alumni Association", logo: caseAlumniAssociation, url: "https://casealumni.org/" },
    ],
    platinum: [
        { name: "Speed Metals", logo: speedMetals, url: "https://speedmetals.com/" },
        { name: "Siemens", logo: siemens, url: "https://www.siemens.com/global/en.html" },
        { name: "SKB Cases", logo: skbCases, url: "https://www.skbcases.com/" },
        { name: "Kenesto", logo: kenesto, url: "https://www.kenesto.com/" },
        { name: "Altair", logo: altair, url: "https://altair.com/" },
        { name: "KISSsoft", logo: kissoft, url: "https://www.kisssoft.com/en" },
    ],
    gold: [
        { name: "Jergens", logo: jergens, url: "https://www.jergensinc.com/" },
        { name: "BWXT", logo: bwxt, url: "https://www.bwxt.com/" },
        // { name: "Orange Vise", logo: orangeVise, url: "https://www.orangevise.com/" },
        { name: "GMN Bearing", logo: gmnBearing, url: "https://www.gmnbt.com/" },
        { name: "SKF", logo: skf, url: "https://www.skf.com/us" },
        { name: "Magna", logo: magna, url: "https://www.magna.com/" },
        { name: "ANSYS", logo: ansys, url: "https://www.ansys.com/" },
        { name: "Skamar", logo: skamar, url: "https://skamar.com/" },
        { name: "Gene Haas Foundation", logo: haas, url: "https://www.ghaasfoundation.org/" },
        { name: "Cleveland Cliffs", logo: clevelandCliffs, url: "https://www.clevelandcliffs.com/" },
        { name: "Misa Metal", logo: misaMetal, url: "https://www.misametal.com/" },
        { name: "SolidWorks", logo: solidWorks, url: "https://www.solidworks.com/" },
        { name: "Michigan Scientific", logo: michiganScientific, url: "https://www.michsci.com/" },
        { name: "Alro", logo: alro, url: "https://www.alro.com/" },
        { name: "Parker", logo: parker, url: "https://www.parker.com/us/en/home.html" },
        { name: "Tylok", logo: tylok, url: "https://www.tylok.com/" },
    ],
    silver: [
        { name: "GMP Friction", logo: gmp, url: "https://gmpfriction.com/" },
        { name: "SGS", logo: sgs, url: "https://www.sgs.com/en" },
        { name: "Sears think[box]", logo: thinkbox, url: "https://case.edu/thinkbox/" },
        { name: "Mastercam", logo: mastercam, url: "https://www.mastercam.com/" },
        { name: "Blaser Swisslube", logo: blaser, url: "https://blaser.com/" },
        { name: "AutomationDirect", logo: automationDirect, url: "https://www.automationdirect.com/adc/home/home" },
        { name: "American Friction", logo: americanFriction, url: "https://www.americanfriction.net/" },
        { name: "Clark", logo: clark, url: "http://www.clark-metal.com/" },
        { name: "Anodizing Specialists", logo: asi, url: "https://www.anodizingspecialists.com/" },
        { name: "Schunk", logo: schunk, url: "https://schunk.com/us/en" },
        { name: "Summit Racing", logo: summitRacing, url: "https://www.summitracing.com/" },
    ],
    bronze: [
        { name: "Nord-Lock Group", logo: nordlock, url: "https://www.nord-lock.com/en-us/" },
        { name: "Southington Offroad", logo: southington, url: "https://southingtonoffroad.com/" },
        { name: "Performance Titanium Group", logo: ptg, url: "https://performancetitanium.com/" },
        { name: "Bolt Depot", logo: boltDepot, url: "https://boltdepot.com/" },
        { name: "FK Rod Ends", logo: fkRodEnds, url: "https://www.fkrodends.com/" },
        { name: "Fathom Realty", logo: fathomRealty, url: "https://fathomrealty.com/" },
        { name: "Gates", logo: gates, url: "https://www.gates.com/us/en.html" },
        { name: "Micro-Measurements", logo: microMeasurements, url: "https://www.micro-measurements.com/" },
        { name: "OSH Cut", logo: oshCut, url: "https://www.oshcut.com/" },
        { name: "Stampede Die", logo: stampedeDie, url: "https://stampededie.com/" },
        { name: "Zintilon", logo: zintilon, url: "https://www.zintilon.com/" },
        { name: "NSK", logo: nsk, url: "https://www.nsk.com/" },
        { name: "Commercial Steel Treating Co", logo: commercialSteelTreating, url: "https://www.commercialsteeltreating.com/" },
        { name: "T-Mac Machine Inc.", logo: tmacMachine, url: "" },
        { name: "PPG", logo: ppg, url: "https://www.ppg.com/" }
    ],
};

// Helper function to get all sponsors as a flat array for carousel use
export const getAllSponsors = (): Array<{ logo: string; link: string }> => {
    const allSponsors: Array<{ logo: string; link: string }> = [];
    
    Object.values(sponsors).forEach(tier => {
        tier.forEach(sponsor => {
            allSponsors.push({
                logo: sponsor.logo,
                link: sponsor.url
            });
        });
    });
    
    return allSponsors;
};
