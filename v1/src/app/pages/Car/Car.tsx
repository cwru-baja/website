import { useState, useRef, useEffect } from 'react';
import { HeaderSimple } from '../../../components/HeaderSimple/HeaderSimple';
import { FooterSocial } from '../../../components/FooterSocial/FooterSocial';
import { HeroSection } from '../../../components/HeroSection/HeroSection';
import { FadeIn } from '../../../components/FadeIn/FadeIn';
import { Title, Text } from '@mantine/core';
import { Carousel, Embla } from '@mantine/carousel';
import styles from './Car.module.css';

import heroImage from '../../../assets/images/LMF02810.jpg';

import frameImage1 from '../../../assets/images/LMF03021.jpg';
import frameImage2 from '../../../assets/images/LMF94729.jpg';
import frameImage3 from '../../../assets/images/LMF09114.jpg';

import suspensionImage1 from '../../../assets/images/LMF09154.jpg';
import suspensionImage3 from '../../../assets/images/LMF09078.jpg';
import suspensionImage4 from '../../../assets/images/LMF21270.jpg';

import brakesImage1 from '../../../assets/images/LMF03118.jpg';
import brakesImage2 from '../../../assets/images/LMF02296.jpg';
import brakesImage3 from '../../../assets/images/LMF03012.jpg';

import drivetrainImage1 from '../../../assets/images/LMF02226.jpg';
import drivetrainImage2 from '../../../assets/images/LMF02442.jpg';
import drivetrainImage3 from '../../../assets/images/LMF00777.jpg';

import electronicsImage1 from '../../../assets/images/LMF02842.jpg';
import electronicsImage2 from '../../../assets/images/LMF16483.png';
import electronicsImage3 from "../../../assets/images/LMF82642.jpg"

export default function Car() {
  const [selectedImages, setSelectedImages] = useState<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(false);

  const carouselRefs = useRef<Record<string, Embla | null>>({});
  const mainCarouselRefs = useRef<Record<string, Embla | null>>({});

  const carData = {
    name: "SR25",
    year: 2025,
    sections: [
      {
        key: "overview",
        title: "OVERVIEW",
        description: "The SR25 vehicle represents the pinnacle of CWRU Motorsports engineering, designed and built over nine months for the 2025 Baja SAE Collegiate Design Series. This vehicle features significant upgrades from previous models, including a new 4 wheel drive system utilizing a propshaft instead of a chain, increased tires size (21 -> 23), and much more.",
      },
      {
        key: "frame",
        title: "FRAME",
        images: [frameImage1, frameImage2, frameImage3],
        description: "Our custom frame provides the foundation for our competition vehicle, designed for optimal strength-to-weight ratio and driver safety.",
        specs: [
          { name: 'Material', value: '4130 Steel' },
          { name: 'Joining Method', value: 'GTAW with ER70S-2 filler material at manually-notched joints' },
          { name: 'Body Panels', value: 'Molded HDPE body panels with aluminum firewall and UHMW skid plate' },
          { name: 'Tubing', value: 'Tubes bent and notched in-house'}
        ]
      },
      {
        key: "suspension",
        title: "SUSPENSION",
        images: [suspensionImage1, suspensionImage3, suspensionImage4],
        description: "Our rear suspension system provides optimal traction and stability across challenging terrain.",
        specs: [
          { name: 'Front Suspension System', value: 'Double wishbones with custom upright and hub CNC-machined in-house' },
          { name: 'Rear Suspension System', value: 'Semi-trailing arm with electron beam welded titanium load-bearing rear half-shaft' },
          { name: 'Steering System', value: 'Completely custom rack and pinion steering system machined by BMT Aerospace' },
          { name: 'Springs and Dampers', value: 'FOX Float 3 with added air chamber, piggyback chamber and semi-active valve' },
          { name: 'Wheel Size', value: '23-inch wheels' },
        ]
      },
      {
        key: "braking",
        title: "BRAKING SYSTEM",
        images: [brakesImage1, brakesImage2, brakesImage3],
        description: "Our custom braking system delivers reliable stopping power and precise control.",
        specs: [
          { name: 'Braking System', value: 'Custom dual master cylinders. Designed and CNC\'d in house' },
          { name: 'Calipers', value: 'Dual piston floating caliper in the front and Fixed quad piston rear brake caliper. Outboard front and inboard rear calipers' },
          { name: 'Rotors', value: 'Water-jet 1/8" topology optimized rotors' },
          { name: 'Pedal Ratio', value: '5:1 pedal ratio for optimal braking force' },
          { name: 'Lines', value: 'Steel-braided Teflon hydraulic lines' },
          { name: 'Fluid', value: 'DOT 4.0 brake fluid' }
        ]
      },
      {
        key: "drivetrain",
        title: "DRIVETRAIN",
        images: [drivetrainImage1, drivetrainImage2, drivetrainImage3],
        description: "Our powertrain system delivers optimal power transfer and efficiency for competition demands.",
        specs: [
          { name: 'Engine', value: 'Kohler CH440 with Baja SAE mandated restriction plate' },
          { name: 'Transmission', value: 'Custom primary and secondary outputting power to final drive gearbox' },
          { name: 'Gear Box', value: 'Custom CNC aluminum, ground steel gears case hardened' },
          { name: 'Axle Joints', value: 'Custom CNC aluminum' },
        ]
      },
      {
        key: "electronics",
        title: "ELECTRONICS",
        images: [electronicsImage1, electronicsImage2, electronicsImage3],
        description: "Our electrical systems provide reliable power distribution and data collection for vehicle optimization.",
        specs: [
          { name: 'Battery', value: '4S Lithium Iron Phosphate (LiFePO4) battery' },
          { name: 'Wiring', value: 'Aerospace grade Tefzel wiring harness' },
          { name: 'Hardware', value: '10+ custom PCBAs for data acquisition and active vehicle control' },
          { name: 'Architecture', value: 'Custom Cyphal/CAN distributed high reliability vehicle network'},
          { name: 'Software', value: '10k+ lines of C++ code for data acquisition and active vehicle control' }
        ]
      }
    ]
  };

  const centerSlide = (sectionKey: string, slideIndex: number) => {
    const embla = carouselRefs.current[sectionKey];
    if (embla) {
      embla.scrollTo(slideIndex);
    }
  };

  const handleImageSelect = (sectionKey: string, imageIndex: number) => {
    setSelectedImages(prev => ({
      ...prev,
      [sectionKey]: imageIndex
    }));

    centerSlide(sectionKey, imageIndex);
  };

  const handlePrevClick = (sectionKey: string) => {
    const embla = carouselRefs.current[sectionKey];
    const currentIndex = selectedImages[sectionKey] || 0;
    const sectionImages = carData.sections.find(section => section.key === sectionKey)?.images;

    if (embla && sectionImages) {
      const newIndex = (currentIndex - 1 + sectionImages.length) % sectionImages.length;
      handleImageSelect(sectionKey, newIndex);
    }
  };

  const handleNextClick = (sectionKey: string) => {
    const embla = carouselRefs.current[sectionKey];
    const currentIndex = selectedImages[sectionKey] || 0;
    const sectionImages = carData.sections.find(section => section.key === sectionKey)?.images;

    if (embla && sectionImages) {
      const newIndex = (currentIndex + 1) % sectionImages.length;
      handleImageSelect(sectionKey, newIndex);
    }
  };

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 992);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return (
      <>
        <HeaderSimple />
        <div className={styles.mainContainer}>
          <HeroSection
              backgroundImage={heroImage}
              title="THE CAR"
              subtitle={carData.name}
              verticalPosition="60%"
          />

          <div className={styles.carContainer}>
            <FadeIn direction="up">
              <div className={styles.carIntro}>
                <Title order={1} className={styles.sectionMainTitle}>THE {carData.name} BAJA VEHICLE</Title>
                <div className={styles.mainAccent}></div>
                <Text className={styles.introDescription}>
                  {carData.sections[0].description}
                </Text>
              </div>
            </FadeIn>

            <div className={styles.carSections}>
              {carData.sections.slice(1).map((section) => (
                  <FadeIn key={section.key} direction="up">
                    <div id={section.key} className={styles.carSection}>
                      <div className={styles.sectionHeader}>
                        <Title order={2} className={styles.sectionTitle}>{section.title}</Title>
                        <div className={styles.sectionAccent}></div>
                      </div>

                      <div className={styles.sectionContent}>
                        <div className={styles.sectionInfo}>
                          <Text className={styles.sectionDescription}>{section.description}</Text>

                          {section.specs && (
                              <div className={styles.specsList}>
                                {section.specs.map((spec, index) => (
                                    <div key={index} className={styles.specItem}>
                                      <Text component="span" className={styles.specName}>{spec.name}</Text>
                                      <Text component="span" className={styles.specValue}>{spec.value}</Text>
                                    </div>
                                ))}
                              </div>
                          )}
                        </div>

                        <div className={styles.sectionImageWrapper}>
                          <div className={styles.sectionImageContainer}>
                            {/* Main image display - Desktop */}
                            {!isMobile && section.images && section.images.length > 0 && (
                                <div className={styles.mainImageContainer}>
                                  <img
                                      src={section.images[selectedImages[section.key] || 0]}
                                      alt={`${section.title} main image`}
                                      className={styles.mainImage}
                                  />
                                </div>
                            )}

                            {/* Mobile Carousel */}
                            {isMobile && section.images && section.images.length > 0 && (
                                <Carousel
                                    getEmblaApi={(embla) => {
                                      mainCarouselRefs.current[section.key] = embla;
                                    }}
                                    className={styles.mobileMainCarousel}
                                    withIndicators
                                    loop
                                    slideSize="100%"
                                    withControls
                                >
                                  {section.images.map((image, index) => (
                                      <Carousel.Slide key={index}>
                                        <div className={styles.mainImageContainer}>
                                          <img
                                              src={image}
                                              alt={`${section.title} image ${index + 1}`}
                                              className={styles.mainImage}
                                          />
                                        </div>
                                      </Carousel.Slide>
                                  ))}
                                </Carousel>
                            )}

                            {/* Thumbnail Carousel - Desktop only */}
                            {!isMobile && section.images && section.images.length > 1 && (
                                <Carousel
                                    getEmblaApi={(embla) => {
                                      carouselRefs.current[section.key] = embla;
                                      if (embla) {
                                        const selectedIndex = selectedImages[section.key] || 0;
                                        embla.scrollTo(selectedIndex);
                                      }
                                    }}
                                    withIndicators={false}
                                    withControls={true}
                                    slideSize="25%"
                                    slideGap="md"
                                    loop
                                    align="center"
                                    className={styles.thumbnailCarousel}
                                    controlsOffset="xs"
                                    controlSize={24}
                                    nextControlProps={{
                                      onClick: (e) => {
                                        e.stopPropagation();
                                        handleNextClick(section.key);
                                      }
                                    }}
                                    previousControlProps={{
                                      onClick: (e) => {
                                        e.stopPropagation();
                                        handlePrevClick(section.key);
                                      }
                                    }}
                                >
                                  {section.images.map((image, index) => (
                                      <Carousel.Slide key={index}>
                                        <div
                                            className={`${styles.thumbnailContainer} ${selectedImages[section.key] === index ? styles.activeThumbnail : ''}`}
                                            onClick={() => handleImageSelect(section.key, index)}
                                        >
                                          <img
                                              src={image}
                                              alt={`${section.title} thumbnail ${index + 1}`}
                                              className={styles.thumbnailImage}
                                          />
                                        </div>
                                      </Carousel.Slide>
                                  ))}
                                </Carousel>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
              ))}
            </div>
          </div>
          <FooterSocial />
        </div>
      </>
  );
}