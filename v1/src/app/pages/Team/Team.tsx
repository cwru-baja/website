import { Image, Text } from '@mantine/core';
import styles from './Team.module.css';

import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple.tsx';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial.tsx';
import { UsersTable } from "../../../components/UsersTable/UsersTable.tsx";
import { FadeIn } from '../../../components/FadeIn/FadeIn.tsx';
import { HeroSection } from '../../../components/HeroSection/HeroSection.tsx';
import heroImage from '../../../assets/images/LMF04266.jpg';

// import LMF04593 from '../../../assets/images/headshots/LMF04593.jpg';
// import LMF04533 from '../../../assets/images/headshots/LMF04533.jpg';
import LMF04640 from '../../../assets/images/headshots/LMF04640.jpg';
// import LMF04651 from '../../../assets/images/headshots/LMF04651.jpg';
// import LMF04502 from '../../../assets/images/headshots/LMF04502.jpg';
import LMF04525 from '../../../assets/images/headshots/LMF04525.jpg';
import LMF04560 from '../../../assets/images/headshots/LMF04560.jpg';
import LMF04478 from '../../../assets/images/headshots/LMF04478.jpg';
import LMF04609 from '../../../assets/images/headshots/LMF04609.jpg';
// import LMF04589 from '../../../assets/images/headshots/LMF04589.jpg';
// import LMF04514 from '../../../assets/images/headshots/LMF04514.jpg';
// import LMF04613 from '../../../assets/images/headshots/LMF04613.jpg';
// import LMF04606 from '../../../assets/images/headshots/LMF04606.jpg';
import LMF04542 from '../../../assets/images/headshots/LMF04542.jpg';
// import LMF04690 from '../../../assets/images/headshots/LMF04690.jpg';
import LMF04627 from '../../../assets/images/headshots/LMF04627.jpg';
import LMF04655 from '../../../assets/images/headshots/LMF04655.jpg';
import LMF04466 from '../../../assets/images/headshots/LMF04466.jpg';
import LMF04721 from '../../../assets/images/headshots/LMF04721.jpg';
// import LMF04619 from '../../../assets/images/headshots/LMF04619.jpg';
// import LMF04673 from '../../../assets/images/headshots/LMF04673.jpg';
// import LMF04762 from '../../../assets/images/headshots/LMF04762.jpg';
import A6406322 from '../../../assets/images/headshots/A6406322.jpg';
import A6406330 from '../../../assets/images/headshots/A6406330.jpg';
import A6406819 from '../../../assets/images/headshots/A6406819.jpg';
import A6406832 from '../../../assets/images/headshots/A6406832.jpg';
import A6406349 from '../../../assets/images/headshots/A6406349.jpg';
import A6406798 from '../../../assets/images/headshots/A6406798.jpg';
import A6406847 from '../../../assets/images/headshots/A6406847.jpg';
import A6406861 from '../../../assets/images/headshots/A6406861.jpg';
import A6406335 from '../../../assets/images/headshots/A6406335.jpg';
import A6406817 from '../../../assets/images/headshots/A6406817.jpg';
import A6406791 from '../../../assets/images/headshots/A6406791.jpg';

// import placeholder from '../../../assets/images/LMF0991.png';

type MemberType = {
    name: string;
    role: string;
    img: string;
    graduationYear: string; // Added graduation year
    linkedin?: string;
};

const executiveBoard: MemberType[] = [
    {
        name: "Brendan Flanagan",
        role: "Team Captain",
        img: LMF04560,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/brendan-flanagan-3220492a3/"
    },
    {
        name: "Ammar Ali Asghar",
        role: "Technical Director",
        img: LMF04478,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/ammar-ali-asghar-8129b524b/"
    },
    {
        name: "Shelley Wei",
        role: "Finance Lead",
        img: LMF04542,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/shelleyywei/"
    },
    {
        name: "Lucy Ma",
        role: "Membership Lead",
        img: LMF04627,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/lucyma-/"
    },
    {
        name: "John Scherer",
        role: "Logistics Lead",
        img: A6406330,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/john-scherer-299264300/"
    },
];

const operationsBoard: MemberType[] = [
    {
        name: "Arnav Manu",
        role: "Front Drivetrain Lead",
        img: LMF04640,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/arnav-manu-667444253/"
    },
    {
        name: "Maureen Manning",
        role: "Manufacturing Lead",
        img: A6406832,
        graduationYear: "2028",
        linkedin: "https://www.linkedin.com/in/maureen--manning/"
    },
    {
        name: "Giovanni Ricupero",
        role: "Brakes & Throttle Lead",
        img: A6406819,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/ricupgio/"
    },
    {
        name: "Joshua Stout",
        role: "Suspension Lead",
        img: LMF04466,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/joshua-martin-stout/"
    },
    {
        name: "Elad Dov Kleinerman",
        role: "CNC Manufacturing Lead",
        img: A6406861,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/elad-dov-kleinerman-mordkowitz-19b423199/"
    },
    {
        name: "Bram Loren",
        role: "Panels & Composites Lead",
        img: A6406817,
        graduationYear: "2028",
        linkedin: "https://www.linkedin.com/in/bramloren/"
    },
    {
        name: "Auston Govender",
        role: "Race Logistics Lead",
        img: LMF04525,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/auston-govender/"
    },
    {
        name: "Kenji Miyake",
        role: "Frame & Radio Lead",
        img: LMF04655,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/gabrielkenjimiyake/"
    },
    {
        name: "Evan Grover",
        role: "Electronics & Systems Lead",
        img: A6406798,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/ehgrover/"
    },
    {
        name: "Matthew Alcantara",
        role: "Rear Drivetrain Lead",
        img: A6406322,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/matthew-allen-alcantara/"
    },
    {
        name: "Logan Senning",
        role: "Test Engineering Lead",
        img: A6406335,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/logan-senning/"
    }
];

const specialtyLeads: MemberType[] = [
    {
        name: "Daniel Clare",
        role: "Static Events Coordinator",
        img: LMF04609,
        graduationYear: "2026",
        linkedin: "https://www.linkedin.com/in/daniel-clare-5b49aa227/"
    },
    {
        name: "Anthony Retelewski",
        role: "Website Lead",
        img: A6406847,
        graduationYear: "2028",
        linkedin: "https://www.linkedin.com/in/anthony-retelewski-4340402aa/"
    },
    {
        name: "Zane Sandelin",
        role: "Cost Report Coordinator",
        img: A6406791,
        graduationYear: "2028",
        linkedin: "https://www.linkedin.com/in/zane-sandelin-010b1b274/"
    },
    {
        name: "Suhani Dangre",
        role: "Business Presentation Lead\n& Social Media Lead",
        img: A6406349,
        graduationYear: "2028",
        linkedin: "https://www.linkedin.com/in/suhani-dangre/"
    },
    {
        name: "Jessica Shue",
        role: "Documentation Lead",
        img: LMF04721,
        graduationYear: "2027",
        linkedin: "https://www.linkedin.com/in/jessica-s-7b7935268/"
    },
];

function Member({ name, role, img, graduationYear, linkedin }: MemberType) {
    const imageContent = (
        <div className={styles.imageWrapper}>
            <Image
                src={img}
                alt={name}
                radius="50%"
                h={150}
                w={150}
                fit="cover"
            />
        </div>
    );

    return (
        <div className={styles.member}>
            {linkedin ? (
                <>
                    <a
                        href={linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkedinLink}
                    >
                        {imageContent}
                        <Text size="lg" mt="md" className={styles.linkedinName}>
                            {name}
                        </Text>
                    </a>
                </>
            ) : (
                <>
                    {imageContent}
                    <Text size="lg" mt="md">
                        {name}
                    </Text>
                </>
            )}
            <Text size="sm">
                {role}
            </Text>
            <Text size="sm" className={styles.gradYear}>
                Class of {graduationYear}
            </Text>
        </div>
    );
}

function MembersList({ members }: { members: MemberType[] }) {
    return (
        <div className={styles.membersContainer}>
            {members.map((member, index) => (
                <FadeIn
                    key={member.name}
                    delay={0.1 * (index % 4)} // Stagger effect based on position
                    direction="up"
                    distance={20}
                >
                    <Member {...member} />
                </FadeIn>
            ))}
        </div>
    );
}

export default function Team() {
    return (
        <>
            <HeaderSimple />
            <div className={styles.mainContainer}>
                <HeroSection
                    backgroundImage={heroImage}
                    title={`MEET THE TEAM`}
                    subtitle={"2024 - 2025"}
                />
                <FadeIn direction="up" delay={0.1}>
                    <div className={styles.section}>
                        <h1 className={styles.sectionTitle}>Executive Board</h1>
                        <MembersList members={executiveBoard} />
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={0.2}>
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Operations Board</h2>
                        <MembersList members={operationsBoard} />
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={0.3}>
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Specialty Leads</h2>
                        <MembersList members={specialtyLeads} />
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={0.4}>
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>General Body</h2>
                        <UsersTable />
                    </div>
                </FadeIn>
            </div>
            <FooterSocial />
        </>
    );
}