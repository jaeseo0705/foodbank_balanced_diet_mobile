Pod::Spec.new do |s|
  s.name = 'FoodbankVisionOCR'
  s.version = '1.0.0'
  s.summary = 'Local Apple Vision text recognition for nutrition label photos'
  s.description = 'Uses the operating system Vision framework without bundling an OCR model.'
  s.homepage = 'https://github.com/jaeseo0705/foodbank_balanced_diet_mobile'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Foodbank Mobile'
  s.source = { :git => s.homepage + '.git', :tag => s.version.to_s }
  s.platforms = { :ios => '16.0' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO', 'CoreGraphics'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'FoodbankNutritionRules' => ['Resources/*.json'] }
end
