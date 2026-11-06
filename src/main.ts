
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? 4000);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Dynamic ESM import for Helmet compatibility.
  const { default: helmet } = await import('helmet');
  app.use(helmet());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR Backend API')
    .setDescription(
      'HR Management REST API built with NestJS and MongoDB',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);

  console.log(`HR Backend running at http://localhost:${port}/api`);
  console.log(`Swagger Docs: http://localhost:${port}/api/docs`);
}

await bootstrap();
