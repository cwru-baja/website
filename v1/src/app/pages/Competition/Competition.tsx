import { Text, Title, Badge, Paper, Grid, Stack } from '@mantine/core';
import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial';
import { FadeIn } from '../../../components/FadeIn/FadeIn';
import styles from './Competition.module.css';
import { HeroSection } from '../../../components/HeroSection/HeroSection';
import heroImage from '../../../assets/images/LMF02976.jpg';

const Award = ({ text }: { text: string }) => {
    const match = text.match(/(\d+)[A-Z]+\s+PLACE\s+(.+)/i);
    if (!match) return null;

    const [, placement, award] = match;
    const placementNum = parseInt(placement);

    return (
        <Badge
            variant="filled"
            color={placementNum <= 3 ? "red" : "dark"}
            radius="sm"
            className={styles.award}
            size="lg"
        >
            {`${placement}${getOrdinalSuffix(parseInt(placement))} Place ${award}`}
        </Badge>
    );
};

const getOrdinalSuffix = (number: number): string => {
    const num = number;
    if (num <= 0) return '';
    if (num > 3 && num < 21) return 'th';
    switch (num % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

interface Competition {
    name: string;
    awards: string[];
}

interface Season {
    year: string;
    competitions: Competition[];
}

const SeasonSection = ({ year, competitions }: { year: string, competitions: Competition[] }) => (
    <FadeIn direction="up" delay={0.1}>
        <div className={styles.seasonSection}>
            <Title order={3} className={styles.seasonTitle}>{year} SEASON</Title>
            <hr className={styles.divider} />
            <Grid gutter="lg">
                {competitions.map((competition, index) => (
                    <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                        <Paper shadow="sm" p="lg" radius="md" className={styles.competitionCard}>
                            <Title order={4} mb="md" className={styles.competitionTitle}>
                                {competition.name}
                            </Title>
                            <Stack gap="xs" align="center">
                                {competition.awards.map((award, awardIndex) => (
                                    <Award key={awardIndex} text={award} />
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>
                ))}
            </Grid>
        </div>
    </FadeIn>
);

// Combined seasons for years with fewer awards
const seasons: Season[] = [
    {
        year: "2024",
        competitions: [
            {
                name: "BAJA SAE CALIFORNIA",
                awards: [
                    "9TH PLACE OVERALL PERFORMANCE",
                    "5TH PLACE DESIGN",
                    "1ST PLACE ACCELERATION",
                    "1ST PLACE HILL CLIMB",
                    "2ND PLACE MANEUVERABILITY",
                    "5TH PLACE SUSPENSION"
                ]
            },
            {
                name: "BAJA SAE WILLIAMSPORT",
                awards: [
                    "6TH PLACE OVERALL PERFORMANCE",
                    "4TH PLACE DESIGN",
                    "1ST PLACE ACCELERATION",
                    "7TH PLACE HILL CLIMB",
                    "5TH PLACE MANEUVERABILITY",
                    "10TH PLACE SUSPENSION"
                ]
            },
            {
                name: "BAJA SAE MICHIGAN",
                awards: [
                    "6th PLACE OVERALL PERFORMACE",
                    "7th PLACE DESIGN",
                    "1st PLACE ACCELERATION",
                    "3rd PLACE HILL CLIMB",
                    "11th PLACE MANEUVERABILITY",
                    "6th PLACE SUSPENSION",
                    "6th PLACE ENDURANCE"
                ]
            }
        ]
    },
    {
        year: "2023",
        competitions: [
            {
                name: "BAJA SAE OSHKOSH",
                awards: [
                    "5TH PLACE OVERALL PERFORMANCE",
                    "5TH PLACE SALES",
                    "5TH PLACE DESIGN",
                    "2ND PLACE ACCELERATION",
                    "4TH PLACE MANEUVERABILITY",
                    "9TH PLACE ENDURANCE"
                ]
            },
            {
                name: "BAJA SAE OREGON",
                awards: [
                    "6TH PLACE OVERALL PERFORMANCE",
                    "9TH PLACE SALES",
                    "3RD PLACE DESIGN",
                    "5TH PLACE ACCELERATION",
                    "4TH PLACE MANEUVERABILITY",
                    "2ND PLACE ENDURANCE"
                ]
            },
            {
                name: "BAJA SAE OHIO",
                awards: [
                    "1ST PLACE OVERALL PERFORMANCE",
                    "2ND PLACE SALES",
                    "8TH PLACE DESIGN",
                    "3RD PLACE ACCELERATION",
                    "2ND PLACE MANEUVERABILITY",
                    "1ST PLACE SUSPENSION",
                    "2ND PLACE ENDURANCE"
                ]
            }
        ]
    },
    {
        year: "2022",
        competitions: [
            {
                name: "BAJA SAE ARIZONA",
                awards: [
                    "5TH PLACE OVERALL PERFORMANCE",
                    "2ND PLACE SALES",
                    "3RD PLACE ACCELERATION",
                    "3RD PLACE MANEUVERABILITY",
                    "6TH PLACE SLED PULL",
                    "8TH PLACE ENDURANCE",
                    "3RD PLACE OVERALL DYNAMIC"
                ]
            },
            {
                name: "BAJA SAE ROCHESTER",
                awards: [
                    "6TH PLACE ACCELERATION",
                ]
            },
            {
                name: "BAJA SAE TENNESSEE TECH",
                awards: [
                    "5TH PLACE AWARD",
                    "4TH PLACE DESIGN",
                    "4TH PLACE ACCELERATION",
                ]
            }
        ]
    },
    {
        year: "2021",
        competitions: [
            {
                name: "BAJA SAE KNOWLEDGE",
                awards: [
                    "2ND PLACE OVERALL PERFORMANCE",
                    "2ND PLACE SALES"
                ]
            },
            {
                name: "BAJA SAE LOUISVILLE",
                awards: [
                    "FORD 1ST PLACE HILL CLIMB",
                    "1ST PLACE MANEUVERABILITY"
                ]
            }
        ]
    },
    {
        year: "2020",
        competitions: [
            {
                name: "BAJA SAE LOUISVILLE",
                awards: [
                    "3RD PLACE SALES"
                ]
            }
        ]
    },
    {
        year: "2019",
        competitions: [
            {
                name: "BAJA SAE ROCHESTER",
                awards: [
                    "1ST PLACE ACCELERATION",
                ]
            }
        ]
    },
    {
        year: "2018",
        competitions: [
            {
                name: "BAJA SAE MARYLAND",
                awards: [
                    "MAGNA 3RD PLACE MANEUVERABILITY"
                ]
            },
            {
                name: "BAJA SAE KANSAS",
                awards: [
                    "POLARIS 3RD PLACE DESIGN"
                ]
            }
        ]
    },
    {
        year: "2017",
        competitions: [
            {
                name: "BAJA SAE CALIFORNIA",
                awards: [
                    "9TH PLACE OVERALL PERFORMANCE"
                ]
            },
            {
                name: "BAJA SAE KANSAS",
                awards: [
                    "8TH PLACE OVERALL PERFORMANCE"
                ]
            },
        ]
    },
    {
        year: "2016",
        competitions: [
            {
                name: "BAJA SAE ROCHESTER",
                awards: [
                    "3RD PLACE ACCELERATION"
                ]
            }
        ]
    }
];

export default function Competition() {
    return (
        <>
            <HeaderSimple />
            <div className={styles.mainContainer}>
                <HeroSection
                    backgroundImage={heroImage}
                    title={"BAJA SAE"}
                    verticalPosition="80%"
                />
                <FadeIn direction="up" delay={0.1}>
                    <div className={styles.introSection}>
                        <h1 className={styles.introTitle}>THE BAJA SAE COLLEGIATE DESIGN SERIES</h1>
                        <Text className={styles.introParagraph}>
                            Baja SAE, sanctioned by the Society of Automotive Engineers, is a collegiate design competition founded in 1976, providing students real-world engineering experience. Teams design, build, and test high-performance, single-seat off-road vehicles tailored for recreational users while adhering to SAE's rigorous standards.
                            Teams also handle fundraising and project management alongside academics. Competitions include technical inspections, design and sales presentations, cost evaluations, dynamic driving events, and a four-hour endurance race.
                            CWRU Motorsports aims to compete in all three 2025 Baja SAE events held in Arizona, Maryland, and South Carolina. More details are available on the SAE International website.
                        </Text>
                    </div>
                </FadeIn>

                <FadeIn direction="up" delay={0.1}>
                    <div className={styles.accomplishmentsSection}>
                        <h1 className={styles.accomplishmentsTitle}>
                            THE TEAM'S GROWING LIST OF ACCOMPLISHMENTS
                        </h1>
                        {seasons.map((season, index) => (
                            <SeasonSection
                                key={index}
                                year={season.year}
                                competitions={season.competitions}
                            />
                        ))}
                    </div>
                </FadeIn>
            </div>
            <FooterSocial />
        </>
    );
}