package org.example.finalproject;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DopplerController {

    // Speed of sound in air in meters per second
    private static final double SPEED_OF_SOUND = 343.0;

    /**
     * Calculates the observed frequency.
     */
    @GetMapping("/calculate-frequency")
    public FrequencyResult calculateFrequency(
            @RequestParam double sourceFrequency,
            @RequestParam double sourceVelocity,
            @RequestParam double observerVelocity) {

        // Doppler Shift Calculation
        // Formula: f' = f0 * (v + v0) / (v - vs)
        double observedFrequency = sourceFrequency * (SPEED_OF_SOUND + observerVelocity) / (SPEED_OF_SOUND - sourceVelocity);

        return new FrequencyResult(observedFrequency);
    }
    
    /**
     * Calculates the intensity.
     */
    @GetMapping("/calculate-intensity")
    public IntensityResult calculateIntensity(
            @RequestParam double sourcePower, 
            @RequestParam double distance) {
        
        // Intensity Calculation (2D Cylindrical Wave)
        // Formula: I = P / (2 * pi * r)
        // Prevent division by zero by clamping distance
        double r = Math.max(distance, 0.01);
        double intensity = sourcePower / (2 * Math.PI * r);
        
        return new IntensityResult(intensity);
    }

    // Helper records for JSON response
    public record FrequencyResult(double observedFrequency) {}
    public record IntensityResult(double intensity) {}
}
