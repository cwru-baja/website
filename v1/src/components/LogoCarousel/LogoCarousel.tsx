import styles from './LogoCarousel.module.css';

interface SponsorData {
  logo: string;
  link?: string;
}

interface LogoCarouselProps {
  sponsors: SponsorData[];
}

export const LogoCarousel = ({ sponsors }: LogoCarouselProps) => {
  return (
    <div className={styles.logoCarousel}>
      <div className={styles.logoTrack}>
        {/* First set */}
        {sponsors.map((sponsor, index) => (
          <div className={styles.logoItem} key={`logo-1-${index}`}>
            {sponsor.link ? (
              <a
                href={sponsor.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.logoLink}
              >
                <img src={sponsor.logo} alt={`Sponsor logo ${index + 1}`} />
              </a>
            ) : (
              <div className={styles.logoLink}>
                <img src={sponsor.logo} alt={`Sponsor logo ${index + 1}`} />
              </div>
            )}
          </div>
        ))}
        {/* Second set */}
        {sponsors.map((sponsor, index) => (
          <div className={styles.logoItem} key={`logo-2-${index}`}>
            {sponsor.link ? (
              <a
                href={sponsor.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.logoLink}
              >
                <img src={sponsor.logo} alt={`Sponsor logo ${index + 1} (copy)`} />
              </a>
            ) : (
              <div className={styles.logoLink}>
                <img src={sponsor.logo} alt={`Sponsor logo ${index + 1} (copy)`} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
