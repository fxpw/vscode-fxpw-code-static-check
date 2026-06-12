<?php

namespace Orchestrator\Api\V1\Controllers;

use OpenApi\Attributes as OA;

#[OA\Tag(
	name: "user_notify_log_types",
	description: "API для управления настройками уведомлений пользователей"
)]
/**
 * @property \Orchestrator\Api\V1\Services\UserNotifyLogTypeService $userNotifyLogTypeService Сервис для работы с настройками уведомлений
 * @property \Orchestrator\Api\V1\Services\UserService $userService Сервис для работы с пользователями
 */
class UserNotifyLogTypeController
{

	/**
	 * Получить список настроек уведомлений
	 */
	#[OA\Get(
		path: "/api/v1/user_notify_log_types",
		summary: "Получить список настроек уведомлений",
		description: "Возвращает список настроек уведомлений пользователей",
		security: [["bearerAuth" => []], ["sessionAuth" => []]],
		tags: ["user_notify_log_types"],
		parameters: [
			new OA\Parameter(
				name: "page",
				in: "query",
				description: "Номер страницы",
				required: false,
				schema: new OA\Schema(type: "integer", minimum: 1, default: 1)
			),
			new OA\Parameter(
				name: "per_page",
				in: "query",
				description: "Количество элементов на странице",
				required: false,
				schema: new OA\Schema(type: "integer", minimum: 1, maximum: 100, default: 20)
			),
			new OA\Parameter(
				name: "user_guid",
				in: "query",
				description: "Фильтр по пользователю (GUID)",
				required: false,
				schema: new OA\Schema(type: "string", format: "uuid", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", example: "550e8400-e29b-41d4-a716-446655440000")
			),
			new OA\Parameter(
				name: "level",
				in: "query",
				description: "Фильтр по уровню",
				required: false,
				schema: new OA\Schema(type: "string")
			),
			new OA\Parameter(
				name: "type",
				in: "query",
				description: "Фильтр по типу",
				required: false,
				schema: new OA\Schema(type: "string")
			)
		],
		responses: [
			new OA\Response(
				response: 200,
				description: "Успешный ответ",
				content: new OA\JsonContent(
					type: "object",
					properties: [
						new OA\Property(property: "success", type: "boolean", example: true),
						new OA\Property(
							property: "data",
							type: "array",
							items: new OA\Items(ref: "#/components/schemas/UserNotifyLogType")
						),
						new OA\Property(
							property: "meta",
							type: "object",
							properties: [
								new OA\Property(property: "page", type: "integer", example: 1),
								new OA\Property(property: "per_page", type: "integer", example: 20),
								new OA\Property(property: "total", type: "integer", example: 100)
							]
						)
					]
				)
			),
			new OA\Response(
				response: 500,
				description: "Внутренняя ошибка сервера",
				content: new OA\JsonContent(
					type: "object",
					properties: [
						new OA\Property(property: "success", type: "boolean", example: false),
						new OA\Property(property: "data", type: "object", nullable: true),
						new OA\Property(
							property: "error",
							type: "object",
							properties: [
								new OA\Property(property: "message", type: "string", example: "Internal server error")
							]
						)
					]
				)
			)
		]
	)]
	public function getUserNotifyLogTypes(Request $request, Response $response): Response
	{
		try {
			$queryParams = $request->getQueryParams();
			$filters = [];

			if (isset($queryParams['user_guid'])) {
				$user = $this->userService->getUserByGuid($queryParams['user_guid']);
				$filters['user_id'] = $user->getId();
			}
			if (isset($queryParams['level'])) {
				$filters['level'] = $queryParams['level'];
			}
			if (isset($queryParams['type'])) {
				$filters['type'] = $queryParams['type'];
			}

			$userNotifyLogTypes = $this->userNotifyLogTypeService->getAllUserNotifyLogTypes($filters);

			// Преобразование в массив для JSON ответа
			$userNotifyLogTypesData = array_map(function ($userNotifyLogType) {
				return $userNotifyLogType->toArray();
			}, $userNotifyLogTypes);

			// Пагинация (простая реализация)
			$page = (int) ($queryParams['page'] ?? 1);
			$perPage = (int) ($queryParams['per_page'] ?? 20);
			$total = count($userNotifyLogTypesData);

			$offset = ($page - 1) * $perPage;
			$paginatedUserNotifyLogTypes = array_slice($userNotifyLogTypesData, $offset, $perPage);

			return self::successResponse($response, $paginatedUserNotifyLogTypes, [
				'meta' => [
					'page' => $page,
					'per_page' => $perPage,
					'total' => $total
				]
			]);
		} catch (\Throwable $e) {
			return self::handleException($response, $e);
		}
	}
}