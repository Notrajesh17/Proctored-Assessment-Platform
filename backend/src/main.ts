import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './common/mongo-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8080',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new MongoExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('Proctored Assessment API')
    .setDescription('Admin + candidate APIs for the screening platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
  console.log(`Swagger at http://localhost:${port}/api/docs`);
}
void bootstrap();
